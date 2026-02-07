import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import {
  jsonResponse,
  requireAnyRole,
  requireCallerContext,
  requireCompanyAccess,
} from "../_shared/auth.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Inconsistency {
  type: 'consecutive_same_type' | 'orphan_entry';
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  eventType: 'entry' | 'exit';
  timestamp: string;
  previousTimestamp?: string;
}

interface AlertRequest {
  employee_id: string;
  inconsistencies: Inconsistency[];
}

const formatInconsistency = (inc: Inconsistency): string => {
  const date = new Date(inc.timestamp);
  const formattedDate = date.toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const typeLabel = inc.type === 'consecutive_same_type' 
    ? 'Fichajes consecutivos del mismo tipo' 
    : 'Entrada sin salida (más de 12 horas)';
  
  return `<li><strong>${typeLabel}</strong> - ${formattedDate}</li>`;
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { employee_id, inconsistencies }: AlertRequest = await req.json();

    if (!employee_id || !inconsistencies || inconsistencies.length === 0) {
      console.log("No employee_id or inconsistencies provided, skipping email");
      return new Response(
        JSON.stringify({ success: true, message: "No inconsistencies to report" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const caller = await requireCallerContext({
      req,
      supabaseAdmin: supabaseClient,
      corsHeaders,
      allowServiceRole: true,
    });
    if (caller instanceof Response) return caller;
    if (caller.kind === 'user') {
      const roleError = requireAnyRole({
        ctx: caller,
        allowed: ['super_admin', 'admin', 'responsible', 'employee'],
        corsHeaders,
      });
      if (roleError) return roleError;
    }

    // Fetch employee details with email and company
    const { data: employee, error: employeeError } = await supabaseClient
      .from('employees')
      .select('first_name, last_name, email, employee_code, company_id')
      .eq('id', employee_id)
      .single();

    if (employeeError || !employee) {
      console.error("Error fetching employee:", employeeError);
      return new Response(
        JSON.stringify({ error: "Employee not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (caller.kind === 'user') {
      const companyAccess = await requireCompanyAccess({
        supabaseAdmin: supabaseClient,
        ctx: caller,
        companyId: employee.company_id,
        corsHeaders,
        allowEmployee: true,
      });
      if (companyAccess instanceof Response) return companyAccess;

      if (!caller.isAdminLike && companyAccess.employeeId && companyAccess.employeeId !== employee_id) {
        return jsonResponse({ error: 'Employees can only trigger alerts for themselves' }, 403, corsHeaders);
      }
    }

    // Check if email notifications are enabled for this company
    const { data: settings } = await supabaseClient
      .from('company_settings')
      .select('setting_value')
      .eq('company_id', employee.company_id)
      .eq('setting_key', 'notifications')
      .maybeSingle();

    const notificationSettings = settings?.setting_value as { inconsistency_email_enabled?: boolean } | null;
    if (notificationSettings?.inconsistency_email_enabled === false) {
      console.log("Inconsistency email notifications disabled for this company");
      return new Response(
        JSON.stringify({ success: true, message: "Notifications disabled" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!employee.email) {
      console.log("Employee has no email configured, skipping notification");
      return new Response(
        JSON.stringify({ success: true, message: "Employee has no email" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!employee.email) {
      console.log("Employee has no email configured, skipping notification");
      return new Response(
        JSON.stringify({ success: true, message: "Employee has no email" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch company name
    const { data: company } = await supabaseClient
      .from('company')
      .select('name')
      .eq('id', employee.company_id)
      .single();

    const companyName = company?.name || 'Tu empresa';
    const employeeName = `${employee.first_name} ${employee.last_name}`;

    // Build email content
    const inconsistencyList = inconsistencies.map(formatInconsistency).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background-color: #fef2f2; padding: 20px; border-radius: 0 0 8px 8px; }
          .alert-icon { font-size: 24px; margin-right: 10px; }
          ul { margin: 15px 0; padding-left: 20px; }
          li { margin-bottom: 10px; background-color: white; padding: 10px; border-radius: 4px; border-left: 3px solid #ef4444; }
          .footer { margin-top: 20px; font-size: 12px; color: #666; }
          .button { display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1><span class="alert-icon">⚠️</span> Alerta de Inconsistencias en Fichajes</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${employeeName}</strong>,</p>
            <p>Se han detectado las siguientes inconsistencias en tus registros de fichaje:</p>
            <ul>
              ${inconsistencyList}
            </ul>
            <p>Te recomendamos revisar tus fichajes y, si es necesario, solicitar una corrección a través del sistema.</p>
            <p>
              <a href="${Deno.env.get('SITE_URL') || 'https://app.example.com'}/employee/request-correction" class="button">
                Solicitar Corrección
              </a>
            </p>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del sistema de fichajes de ${companyName}.</p>
            <p>Si crees que esto es un error, contacta con tu responsable.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log(`Sending inconsistency alert email to ${employee.email}`);

    const emailResponse = await resend.emails.send({
      from: `${companyName} Fichajes <${resendFromEmail}>`,
      to: [employee.email],
      subject: `⚠️ Alerta: ${inconsistencies.length} inconsistencia${inconsistencies.length > 1 ? 's' : ''} en tus fichajes`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    // Log the notification in audit_log
    await supabaseClient.from('audit_log').insert({
      action: 'inconsistency_alert_sent',
      actor_type: 'system',
      entity_type: 'employee',
      entity_id: employee_id,
      company_id: employee.company_id,
      new_values: {
        inconsistency_count: inconsistencies.length,
        email_sent_to: employee.email,
        inconsistencies: inconsistencies,
      },
    });

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in inconsistency-alert function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
