import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    const { 
      format: exportFormat, 
      entity_type, 
      date_range, 
      employee_id,
      record_count,
      filters 
    } = await req.json();

    console.log(`Export logged: ${exportFormat} for ${entity_type}, user: ${userId}, records: ${record_count}`);

    // Insert audit log entry
    const { error } = await supabase
      .from('audit_log')
      .insert({
        actor_type: userId ? 'admin' : 'system',
        actor_id: userId,
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
