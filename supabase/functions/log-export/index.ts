import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, requireCallerContext, requireCompanyAccess } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const caller = await requireCallerContext({ req, supabaseAdmin: supabase, corsHeaders });
    if (caller instanceof Response) return caller;
    if (caller.kind !== 'user') {
      return jsonResponse({ success: false, error: 'Unauthorized caller' }, 401, corsHeaders);
    }

    const { 
      format: exportFormat, 
      entity_type, 
      date_range, 
      employee_id,
      record_count,
      filters 
    } = await req.json();

    let companyId: string | null = null;
    if (employee_id) {
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('id, company_id, user_id')
        .eq('id', employee_id)
        .maybeSingle();

      if (employeeError) {
        throw new Error(`Unable to resolve employee: ${employeeError.message}`);
      }

      if (employee?.company_id) {
        companyId = employee.company_id;
        const companyAccess = await requireCompanyAccess({
          supabaseAdmin: supabase,
          ctx: caller,
          companyId: employee.company_id,
          corsHeaders,
          allowEmployee: true,
        });
        if (companyAccess instanceof Response) return companyAccess;

        if (companyAccess.employeeId && employee.user_id && employee.user_id !== caller.userId) {
          return jsonResponse(
            { success: false, error: 'Employees can only log exports for themselves' },
            403,
            corsHeaders,
          );
        }
      }
    }

    console.log(
      `Export logged: ${exportFormat} for ${entity_type}, user: ${caller.userId}, records: ${record_count}`,
    );

    // Insert audit log entry
    const { error } = await supabase
      .from('audit_log')
      .insert({
        actor_type: 'user',
        actor_id: caller.userId,
        company_id: companyId,
        action: 'export',
        entity_type: entity_type || 'time_events',
        new_values: {
          format: exportFormat,
          date_range,
          employee_id,
          record_count,
          filters,
          exported_at: new Date().toISOString(),
        },
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
        user_agent: req.headers.get('user-agent'),
      });

    if (error) {
      console.error('Error logging export:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al registrar exportación' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Log export error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
