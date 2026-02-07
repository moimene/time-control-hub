import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  jsonResponse,
  requireAnyRole,
  requireCallerContext,
  requireCompanyAccess,
} from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendRequest {
  employee_id: string;
  subject: string;
  body: string;
  category?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const caller = await requireCallerContext({ req, supabaseAdmin: supabase, corsHeaders });
    if (caller instanceof Response) return caller;
    if (caller.kind !== 'user') {
      return jsonResponse({ error: 'Unauthorized caller' }, 401, corsHeaders);
    }
    const roleError = requireAnyRole({ ctx: caller, allowed: ['employee'], corsHeaders });
    if (roleError) return roleError;

    const { employee_id, subject, body, category }: SendRequest = await req.json();

    if (!employee_id || !subject || !body) {
      return jsonResponse({ error: 'employee_id, subject y body son requeridos' }, 400, corsHeaders);
    }

    // Verify employee exists and get company_id
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, company_id, first_name, last_name, user_id, status')
      .eq('id', employee_id)
      .single();

    if (empError || !employee) {
      console.error('Employee not found:', empError);
      return jsonResponse({ error: 'Empleado no encontrado' }, 404, corsHeaders);
    }

    if (employee.status !== 'active') {
      return jsonResponse({ error: 'El empleado no está activo' }, 400, corsHeaders);
    }

    if (!employee.user_id || employee.user_id !== caller.userId) {
      return jsonResponse({ error: 'Employees can only send messages as themselves' }, 403, corsHeaders);
    }

    const companyAccess = await requireCompanyAccess({
      supabaseAdmin: supabase,
      ctx: caller,
      companyId: employee.company_id,
      corsHeaders,
      allowEmployee: true,
    });
    if (companyAccess instanceof Response) return companyAccess;

    const now = new Date().toISOString();

    // Create message thread with sender_role = 'employee' and audience_type = 'admin'
    const { data: thread, error: threadError } = await supabase
      .from('message_threads')
      .insert({
        company_id: employee.company_id,
        subject,
        thread_type: category || 'consulta',
        priority: 'normal',
        status: 'sent',
        sent_at: now,
        created_by: employee.user_id,
        sender_role: 'employee',
        audience_type: 'admin',
        audience_filter: { employee_id: employee_id },
        requires_read_confirmation: false,
        requires_response: false,
        requires_signature: false,
        certification_level: 'none',
        recipient_count: 0,
      })
      .select('id')
      .single();

    if (threadError) {
      console.error('Error creating thread:', threadError);
      throw threadError;
    }

    console.log('Thread created:', thread.id);

    // Create message content
    const { error: contentError } = await supabase
      .from('message_contents')
      .insert({
        thread_id: thread.id,
        body_text: body,
        body_markdown: body,
        is_current: true,
      });

    if (contentError) {
      console.error('Error creating content:', contentError);
      throw contentError;
    }

    // Get admin users for this company to notify them
    const { data: adminUsers } = await supabase
      .from('user_company')
      .select('user_id')
      .eq('company_id', employee.company_id);

    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'super_admin']);

    // Find users that are both in the company AND have admin role
    const adminUserIds = adminUsers?.map(u => u.user_id) || [];
    const roleUserIds = adminRoles?.map(r => r.user_id) || [];
    const companyAdminIds = adminUserIds.filter(id => roleUserIds.includes(id));

    console.log('Company admins to notify:', companyAdminIds.length);

    // Create notifications for each admin (insert into employee_notifications won't work, 
    // we need a different approach - could use a separate admin_notifications table or 
    // just rely on the message_threads query with sender_role='employee')

    // Create message evidence for audit trail
    const contentHash = await generateHash(body);
    const { error: evidenceError } = await supabase
      .from('message_evidence')
      .insert({
        thread_id: thread.id,
        event_type: 'sent',
        event_timestamp: now,
        content_hash: contentHash,
        event_data: {
          sender_employee_id: employee_id,
          sender_name: `${employee.first_name} ${employee.last_name}`,
          subject,
          category: category || 'consulta',
        },
      });

    if (evidenceError) {
      console.warn('Evidence creation failed (non-critical):', evidenceError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        thread_id: thread.id,
        message: 'Mensaje enviado correctamente'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in employee-message-send:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
