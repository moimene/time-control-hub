import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationRecord {
  id: string
  company_id: string
  notification_type: string
  channel: 'in_app' | 'email' | 'both'
  recipient_email: string | null
  recipient_user_id: string | null
  recipient_employee_id: string | null
  subject: string | null
  body_json: Record<string, unknown>
  violation_id: string | null
  incident_id: string | null
  scheduled_for: string
  sent_at: string | null
  failed_at: string | null
  error_message: string | null
  quiet_hours_delayed: boolean | null
}

interface EscalationRule {
  severity: 'info' | 'warn' | 'critical'
  initial_delay_hours: number
  escalation_delay_hours: number
  escalation_levels: string[]
}

const ESCALATION_RULES: EscalationRule[] = [
  { severity: 'critical', initial_delay_hours: 0, escalation_delay_hours: 4, escalation_levels: ['admin', 'super_admin'] },
  { severity: 'warn', initial_delay_hours: 1, escalation_delay_hours: 24, escalation_levels: ['admin'] },
  { severity: 'info', initial_delay_hours: 24, escalation_delay_hours: 0, escalation_levels: [] },
]

const QUIET_HOURS = { start: 22, end: 8 } // 22:00 - 08:00

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const resend = new Resend(resendApiKey)

    const now = new Date()
    const currentHour = now.getUTCHours()
    const isQuietHours = currentHour >= QUIET_HOURS.start || currentHour < QUIET_HOURS.end

    console.log(`[notification-dispatcher] Starting dispatch at ${now.toISOString()}, quiet_hours: ${isQuietHours}`)

    // 1. Process pending notifications
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('compliance_notifications')
      .select('*')
      .is('sent_at', null)
      .is('failed_at', null)
      .lte('scheduled_for', now.toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(50)

    if (fetchError) {
      throw new Error(`Failed to fetch notifications: ${fetchError.message}`)
    }

    console.log(`[notification-dispatcher] Found ${pendingNotifications?.length || 0} pending notifications`)

    const results = {
      processed: 0,
      sent: 0,
      delayed: 0,
      failed: 0,
      escalated: 0,
    }

    for (const notification of (pendingNotifications as NotificationRecord[]) || []) {
      results.processed++

      // Check quiet hours for non-critical notifications
      if (isQuietHours && notification.notification_type !== 'critical_violation') {
        // Delay to next morning
        const nextMorning = new Date(now)
        nextMorning.setUTCHours(QUIET_HOURS.end, 0, 0, 0)
        if (nextMorning <= now) {
          nextMorning.setDate(nextMorning.getDate() + 1)
        }

        await supabase
          .from('compliance_notifications')
          .update({
            scheduled_for: nextMorning.toISOString(),
            quiet_hours_delayed: true,
          })
          .eq('id', notification.id)

        results.delayed++
        console.log(`[notification-dispatcher] Delayed notification ${notification.id} due to quiet hours`)
        continue
      }

      // Send notification based on channel
      try {
        if (notification.channel === 'email' || notification.channel === 'both') {
          if (notification.recipient_email) {
            await sendEmailNotification(resend, notification)
          }
        }

        // Mark as sent
        await supabase
          .from('compliance_notifications')
          .update({ sent_at: now.toISOString() })
          .eq('id', notification.id)

        results.sent++
        console.log(`[notification-dispatcher] Sent notification ${notification.id}`)

      } catch (sendError: unknown) {
        const errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error'
        await supabase
          .from('compliance_notifications')
          .update({
            failed_at: now.toISOString(),
            error_message: errorMessage,
          })
          .eq('id', notification.id)

        results.failed++
        console.error(`[notification-dispatcher] Failed to send notification ${notification.id}:`, errorMessage)
      }
    }

    // 2. Check for escalation needs
    const escalationResults = await processEscalations(supabase)
    results.escalated = escalationResults.escalated

    // 3. Create notifications for unacknowledged violations
    const newNotifications = await createViolationNotifications(supabase)

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: now.toISOString(),
        quiet_hours: isQuietHours,
        results,
        new_notifications_created: newNotifications,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('[notification-dispatcher] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function sendEmailNotification(resend: InstanceType<typeof Resend>, notification: NotificationRecord) {
  const body = notification.body_json as Record<string, string>
  
  const html = generateEmailHtml(notification.notification_type, body)

  const response = await resend.emails.send({
    from: 'Cumplimiento <compliance@resend.dev>',
    to: [notification.recipient_email!],
    subject: notification.subject || 'Alerta de Cumplimiento',
    html,
  })

  if (response.error) {
    throw new Error(response.error.message)
  }

  console.log(`[notification-dispatcher] Email sent to ${notification.recipient_email}`)
}

function generateEmailHtml(type: string, body: Record<string, string>): string {
  const severityColors: Record<string, string> = {
    critical: '#dc2626',
    warn: '#f59e0b',
    info: '#3b82f6',
  }

  const severity = body.severity || 'info'
  const color = severityColors[severity] || '#3b82f6'

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: ${color}20; color: ${color}; }
          .details { background: white; padding: 16px; border-radius: 8px; margin-top: 16px; border: 1px solid #e5e7eb; }
          .footer { margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 20px;">⚠️ Alerta de Cumplimiento</h1>
          </div>
          <div class="content">
            <p><span class="badge">${severity.toUpperCase()}</span></p>
            <h2 style="margin-top: 16px;">${body.title || 'Violación detectada'}</h2>
            <p>${body.description || ''}</p>
            
            <div class="details">
              <p><strong>Empleado:</strong> ${body.employee_name || 'N/A'}</p>
              <p><strong>Fecha:</strong> ${body.violation_date || 'N/A'}</p>
              <p><strong>Regla:</strong> ${body.rule_name || 'N/A'}</p>
              ${body.evidence ? `<p><strong>Evidencia:</strong> ${body.evidence}</p>` : ''}
            </div>
            
            <p style="margin-top: 20px;">
              Por favor, revise esta alerta en el panel de cumplimiento y tome las acciones necesarias.
            </p>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del sistema de cumplimiento. No responda a este correo.</p>
          </div>
        </div>
      </body>
    </html>
  `
}

// deno-lint-ignore no-explicit-any
async function processEscalations(supabase: any) {
  const now = new Date()
  let escalated = 0
  const { data: openIncidents } = await supabase
    .from('compliance_incidents')
    .select('*, compliance_violations(severity)')
    .in('status', ['open', 'acknowledged'])
    .order('created_at', { ascending: true })

  for (const incident of openIncidents || []) {
    const severity = incident.compliance_violations?.severity || 'info'
    const rule = ESCALATION_RULES.find(r => r.severity === severity)
    if (!rule || rule.escalation_levels.length === 0) continue

    const createdAt = new Date(incident.created_at)
    const hoursOpen = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)

    // Check if escalation is needed
    if (hoursOpen > rule.escalation_delay_hours && incident.status === 'open') {
      // Get admin emails for escalation
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', rule.escalation_levels)

      if (admins?.length) {
        for (const admin of admins) {
          // Get user email from auth (we'll use a simple approach here)
          const { data: employee } = await supabase
            .from('employees')
            .select('email')
            .eq('user_id', admin.user_id)
            .single()

          if (employee?.email) {
            // Create escalation notification
            await supabase.from('compliance_notifications').insert({
              company_id: incident.company_id,
              notification_type: 'escalation',
              channel: 'email',
              recipient_email: employee.email,
              recipient_user_id: admin.user_id,
              subject: `[ESCALACIÓN] Incidencia sin resolver: ${incident.title}`,
              body_json: {
                title: `Escalación: ${incident.title}`,
                description: `Esta incidencia lleva ${Math.round(hoursOpen)} horas sin resolver`,
                severity,
                incident_id: incident.id,
              },
              incident_id: incident.id,
              scheduled_for: now.toISOString(),
            })
            escalated++
          }
        }
      }

      // Update incident to acknowledged to prevent repeated escalations
      await supabase
        .from('compliance_incidents')
        .update({ status: 'acknowledged', acknowledged_at: now.toISOString() })
        .eq('id', incident.id)
    }
  }

  console.log(`[notification-dispatcher] Escalated ${escalated} notifications`)
  return { escalated }
}

// deno-lint-ignore no-explicit-any
async function createViolationNotifications(supabase: any) {
  const now = new Date()
  let created = 0

  // Find new violations without notifications
  const { data: newViolations } = await supabase
    .from('compliance_violations')
    .select(`
      id, company_id, employee_id, rule_code, severity, violation_date, evidence_json,
      employees!inner(first_name, last_name, email)
    `)
    .eq('status', 'open')
    .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())

  for (const violation of newViolations || []) {
    // Check if notification already exists
    const { data: existingNotification } = await supabase
      .from('compliance_notifications')
      .select('id')
      .eq('violation_id', violation.id)
      .limit(1)

    if (existingNotification?.length) continue

    const employee = violation.employees as { first_name: string; last_name: string; email: string | null }
    const evidence = violation.evidence_json as Record<string, unknown>

    // Create notification
    await supabase.from('compliance_notifications').insert({
      company_id: violation.company_id,
      notification_type: `${violation.severity}_violation`,
      channel: violation.severity === 'critical' ? 'both' : 'email',
      recipient_email: employee.email,
      recipient_employee_id: violation.employee_id,
      subject: `Alerta de cumplimiento: ${evidence.rule_name || violation.rule_code}`,
      body_json: {
        title: evidence.rule_name || violation.rule_code,
        description: `Se ha detectado una violación de cumplimiento`,
        severity: violation.severity,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        violation_date: violation.violation_date,
        rule_name: evidence.rule_name || violation.rule_code,
        evidence: JSON.stringify(evidence),
      },
      violation_id: violation.id,
      scheduled_for: getScheduledTime(violation.severity, now).toISOString(),
    })

    created++

    // For critical violations, also create incident
    if (violation.severity === 'critical') {
      const { data: existingIncident } = await supabase
        .from('compliance_incidents')
        .select('id')
        .eq('violation_id', violation.id)
        .limit(1)

      if (!existingIncident?.length) {
        // Calculate SLA due time (4 hours for critical)
        const slaDue = new Date(now.getTime() + 4 * 60 * 60 * 1000)

        await supabase.from('compliance_incidents').insert({
          company_id: violation.company_id,
          violation_id: violation.id,
          title: `${evidence.rule_name || violation.rule_code} - ${employee.first_name} ${employee.last_name}`,
          description: `Violación crítica detectada el ${violation.violation_date}`,
          severity: violation.severity,
          status: 'open',
          sla_due_at: slaDue.toISOString(),
        })
      }
    }
  }

  console.log(`[notification-dispatcher] Created ${created} new notifications`)
  return created
}

function getScheduledTime(severity: string, now: Date): Date {
  const rule = ESCALATION_RULES.find(r => r.severity === severity)
  const delayHours = rule?.initial_delay_hours || 0
  return new Date(now.getTime() + delayHours * 60 * 60 * 1000)
}
