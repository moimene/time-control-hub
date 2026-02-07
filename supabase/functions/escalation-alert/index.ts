import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EscalationRule {
  id: string;
  company_id: string | null;
  level: number;
  severity_threshold: string;
  time_threshold_minutes: number;
  consecutive_failures_threshold: number;
  notify_emails: string[];
  notify_in_app: boolean;
}

interface QTSPLog {
  id: string;
  company_id: string | null;
  action: string;
  status: string;
  error_message: string | null;
  created_at: string;
  response_payload: any;
}

type ErrorCategory = 'DNS_ERROR' | 'TIMEOUT' | 'HTTP_4XX' | 'HTTP_5XX' | 'CONNECTION_REFUSED' | 'SSL_ERROR' | 'UNKNOWN';

function categorizeError(message: string | null | undefined): ErrorCategory {
  if (!message) return 'UNKNOWN';
  const msg = message.toLowerCase();
  if (msg.includes('dns') || msg.includes('name not known') || msg.includes('getaddrinfo')) return 'DNS_ERROR';
  if (msg.includes('timeout') || msg.includes('timed out')) return 'TIMEOUT';
  if (msg.includes('connection refused') || msg.includes('econnrefused')) return 'CONNECTION_REFUSED';
  if (msg.includes('ssl') || msg.includes('certificate') || msg.includes('tls')) return 'SSL_ERROR';
  if (msg.includes('401') || msg.includes('403') || msg.includes('404') || msg.includes('400')) return 'HTTP_4XX';
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return 'HTTP_5XX';
  return 'UNKNOWN';
}

function getSeverityFromCategory(category: ErrorCategory, consecutiveFailures: number): string {
  if (consecutiveFailures >= 10) return 'critical';
  if (['DNS_ERROR', 'CONNECTION_REFUSED', 'SSL_ERROR'].includes(category)) return 'critical';
  if (['HTTP_5XX', 'TIMEOUT'].includes(category)) return 'warn';
  return 'info';
}

async function sendEmailNotification(
  emails: string[],
  subject: string,
  body: string,
  resendApiKey: string,
  resendFromEmail: string
): Promise<boolean> {
  if (!resendApiKey || !resendFromEmail || emails.length === 0) return false;
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `QTSP Alerts <${resendFromEmail}>`,
        to: emails,
        subject,
        html: body,
      }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

function buildEmailBody(log: QTSPLog, level: number, category: ErrorCategory): string {
  const levelNames = { 1: 'L1 - Soporte Básico', 2: 'L2 - Soporte Avanzado', 3: 'L3 - Ingeniería' };
  const errorMessage = log.error_message || log.response_payload?.message || 'Error desconocido';
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">🚨 Alerta QTSP Escalada - ${levelNames[level as keyof typeof levelNames] || `Nivel ${level}`}</h1>
      </div>
      <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef;">
        <h2 style="color: #333; margin-top: 0;">Detalles del Error</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Categoría:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${category}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Acción:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${log.action}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Mensaje:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${errorMessage}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Fecha:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(log.created_at).toLocaleString('es-ES')}</td></tr>
        </table>
        <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 4px;">
          <strong>⚠️ Acción requerida:</strong> Por favor, revise este error y tome las medidas necesarias.
        </div>
      </div>
      <div style="background: #333; color: #ccc; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
        Sistema de Monitoreo QTSP - Alerta automática
      </div>
    </div>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action } = await req.json();

    if (action === 'check_and_escalate') {
      // Get active escalation rules
      const { data: rules, error: rulesError } = await supabase
        .from('escalation_rules')
        .select('*')
        .eq('is_active', true)
        .order('level', { ascending: true });

      if (rulesError) throw rulesError;

      // Get recent unresolved errors (last 24 hours)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: errorLogs, error: logsError } = await supabase
        .from('qtsp_audit_log')
        .select('*')
        .eq('status', 'error')
        .gte('created_at', since)
        .order('created_at', { ascending: false });

      if (logsError) throw logsError;

      const escalations: any[] = [];

      for (const log of errorLogs || []) {
        const errorMessage = log.error_message || log.response_payload?.message;
        const category = categorizeError(errorMessage);
        
        // Count consecutive failures for this company
        const { count: consecutiveCount } = await supabase
          .from('qtsp_audit_log')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', log.company_id)
          .eq('status', 'error')
          .gte('created_at', since);

        const severity = getSeverityFromCategory(category, consecutiveCount || 0);
        const minutesSinceError = (Date.now() - new Date(log.created_at).getTime()) / 60000;

        // Check if already escalated
        const { data: existingEscalation } = await supabase
          .from('escalation_history')
          .select('id, escalation_level')
          .eq('qtsp_log_id', log.id)
          .order('escalation_level', { ascending: false })
          .limit(1);

        const currentEscalationLevel = existingEscalation?.[0]?.escalation_level || 0;

        // Find applicable rules
        for (const rule of (rules || []) as EscalationRule[]) {
          if (rule.level <= currentEscalationLevel) continue;
          
          const severityMatch = 
            (rule.severity_threshold === 'info') ||
            (rule.severity_threshold === 'warn' && severity !== 'info') ||
            (rule.severity_threshold === 'critical' && severity === 'critical');
          
          const timeMatch = minutesSinceError >= rule.time_threshold_minutes;
          const failuresMatch = (consecutiveCount || 0) >= (rule.consecutive_failures_threshold || 0);

          if (severityMatch && timeMatch && failuresMatch) {
            // Create escalation
            const { data: escalation, error: escError } = await supabase
              .from('escalation_history')
              .insert({
                company_id: log.company_id,
                rule_id: rule.id,
                qtsp_log_id: log.id,
                escalation_level: rule.level,
                error_category: category,
                error_message: errorMessage,
                notification_channel: rule.notify_in_app && rule.notify_emails.length > 0 ? 'both' : 
                                      rule.notify_emails.length > 0 ? 'email' : 'in_app',
              })
              .select()
              .single();

            if (escError) {
              console.error('Error creating escalation:', escError);
              continue;
            }

            // Send notifications
            let notificationSent = false;
            
            if (rule.notify_emails.length > 0) {
              const subject = `[QTSP Alert L${rule.level}] ${category} - Acción requerida`;
              const body = buildEmailBody(log, rule.level, category);
              notificationSent = await sendEmailNotification(
                rule.notify_emails,
                subject,
                body,
                resendApiKey,
                resendFromEmail,
              );
            }

            // Update escalation with notification status
            await supabase
              .from('escalation_history')
              .update({ notification_sent: notificationSent || rule.notify_in_app })
              .eq('id', escalation.id);

            escalations.push({
              log_id: log.id,
              level: rule.level,
              category,
              notification_sent: notificationSent,
            });

            console.log(`Escalated log ${log.id} to level ${rule.level}`);
            break; // Only escalate to next level, not multiple at once
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          escalations_created: escalations.length,
          details: escalations 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'acknowledge') {
      const { escalation_id, user_id } = await req.json();
      
      const { error } = await supabase
        .from('escalation_history')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user_id,
        })
        .eq('id', escalation_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'resolve') {
      const { escalation_id } = await req.json();
      
      const { error } = await supabase
        .from('escalation_history')
        .update({
          resolved_at: new Date().toISOString(),
        })
        .eq('id', escalation_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_active_escalations') {
      const { data, error } = await supabase
        .from('escalation_history')
        .select(`
          *,
          escalation_rules(level, severity_threshold, notify_emails),
          qtsp_audit_log(action, status, created_at, error_message, response_payload)
        `)
        .is('resolved_at', null)
        .order('triggered_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, escalations: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Escalation alert error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
