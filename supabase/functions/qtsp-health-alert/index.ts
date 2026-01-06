import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthCheckPayload {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  latency_ms?: number;
  timestamp: string;
  consecutive_failures: number;
  alert_type?: 'failure' | 'recovery';
  downtime_minutes?: number;
}

interface AlertRecipient {
  email: string;
  name?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: HealthCheckPayload = await req.json();
    const { status, message, latency_ms, timestamp, consecutive_failures, alert_type = 'failure', downtime_minutes } = payload;

    // Handle recovery alerts
    const isRecoveryAlert = alert_type === 'recovery' && status === 'healthy';
    
    // For failure alerts: only send for unhealthy status with 5+ minutes of failures
    // Assuming health checks run every 30 seconds, 10 consecutive failures = 5 minutes
    if (!isRecoveryAlert && (status === 'healthy' || consecutive_failures < 10)) {
      return new Response(
        JSON.stringify({ 
          sent: false, 
          reason: status === 'healthy' 
            ? 'System is healthy (use alert_type=recovery for recovery alerts)' 
            : `Only ${consecutive_failures} consecutive failures (need 10 for 5 min)` 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get super_admin users for alerts
    const { data: superAdmins, error: adminsError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'super_admin');

    if (adminsError) {
      throw new Error(`Failed to fetch super admins: ${adminsError.message}`);
    }

    if (!superAdmins || superAdmins.length === 0) {
      return new Response(
        JSON.stringify({ sent: false, reason: 'No super admins configured' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get emails from auth.users
    const recipients: AlertRecipient[] = [];
    for (const admin of superAdmins) {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(admin.user_id);
      if (!userError && userData?.user?.email) {
        recipients.push({ email: userData.user.email });
      }
    }

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ sent: false, reason: 'No valid email addresses found' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const failureMinutes = downtime_minutes || Math.round(consecutive_failures * 0.5); // Assuming 30s intervals
    
    // Different content for recovery vs failure alerts
    let statusEmoji: string;
    let statusLabel: string;
    let headerColor: string;
    let alertBoxStyle: string;
    let alertMessage: string;

    if (isRecoveryAlert) {
      statusEmoji = '✅';
      statusLabel = 'RECUPERADO';
      headerColor = '#16a34a';
      alertBoxStyle = 'background: #f0fdf4; border: 1px solid #86efac;';
      alertMessage = `El servicio QTSP (Digital Trust) se ha recuperado después de ${failureMinutes} minutos de inactividad.`;
    } else {
      statusEmoji = status === 'unhealthy' ? '🔴' : '🟡';
      statusLabel = status === 'unhealthy' ? 'NO SALUDABLE' : 'DEGRADADO';
      headerColor = status === 'unhealthy' ? '#dc2626' : '#f59e0b';
      alertBoxStyle = 'background: #fef2f2; border: 1px solid #fecaca;';
      alertMessage = `El servicio QTSP (Digital Trust) ha estado ${status === 'unhealthy' ? 'no disponible' : 'degradado'} durante ${failureMinutes} minutos.`;
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: ${headerColor}; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 24px; }
    .alert-box { ${alertBoxStyle} border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    .metric { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
    .metric:last-child { border-bottom: none; }
    .metric-label { color: #6b7280; }
    .metric-value { font-weight: 600; color: #1f2937; }
    .footer { background: #f9fafb; padding: 16px 24px; text-align: center; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${statusEmoji} QTSP ${statusLabel}</h1>
    </div>
    <div class="content">
      <div class="alert-box">
        <strong>${alertMessage}</strong>
      </div>
      
      <div class="metric">
        <span class="metric-label">Estado</span>
        <span class="metric-value">${statusLabel}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Mensaje</span>
        <span class="metric-value">${message}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Latencia</span>
        <span class="metric-value">${latency_ms ? `${latency_ms}ms` : 'N/A'}</span>
      </div>
      ${!isRecoveryAlert ? `<div class="metric">
        <span class="metric-label">Fallos consecutivos</span>
        <span class="metric-value">${consecutive_failures}</span>
      </div>` : `<div class="metric">
        <span class="metric-label">Tiempo de inactividad</span>
        <span class="metric-value">${failureMinutes} minutos</span>
      </div>`}
      <div class="metric">
        <span class="metric-label">Timestamp</span>
        <span class="metric-value">${new Date(timestamp).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</span>
      </div>
    </div>
    <div class="footer">
      <p>Este es un mensaje automático del sistema de monitorización QTSP.</p>
      <p>Accede al panel de Super Admin para más detalles.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email to all recipients
    const subjectText = isRecoveryAlert 
      ? `${statusEmoji} QTSP Recuperado - Sistema operativo tras ${failureMinutes} min`
      : `${statusEmoji} Alerta QTSP: Sistema ${statusLabel} - ${failureMinutes} min`;
    
    const emailPromises = recipients.map(recipient =>
      resend.emails.send({
        from: "QTSP Monitor <onboarding@resend.dev>",
        to: [recipient.email],
        subject: subjectText,
        html: htmlContent,
      })
    );

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failedCount = results.filter(r => r.status === 'rejected').length;

    // Log to qtsp_audit_log
    await supabase.from('qtsp_audit_log').insert({
      action: isRecoveryAlert ? 'health_recovery_sent' : 'health_alert_sent',
      status: failedCount === 0 ? 'success' : 'partial',
      request_payload: { 
        health_status: status,
        alert_type: isRecoveryAlert ? 'recovery' : 'failure',
        downtime_minutes: failureMinutes,
        consecutive_failures,
        recipients_count: recipients.length 
      },
      response_payload: { 
        success_count: successCount, 
        failed_count: failedCount 
      },
    });

    return new Response(
      JSON.stringify({
        sent: true,
        recipients: successCount,
        failed: failedCount,
        status,
        consecutive_failures,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error sending health alert:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
