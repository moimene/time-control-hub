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

    console.log('[sla-escalation] Starting SLA check...');

    // 1. Obtener solicitudes pendientes con SLA vencido
    const { data: pendingRequests, error: fetchError } = await supabase
      .from('absence_requests')
      .select(`
        id,
        employee_id,
        company_id,
        created_at,
        absence_type_id,
        start_date,
        end_date,
        absence_types (
          id, name, code, sla_hours, approval_flow
        ),
        employees (
          id, first_name, last_name, department
        )
      `)
      .eq('status', 'pending');

    if (fetchError) {
      console.error('[sla-escalation] Error fetching requests:', fetchError);
      throw fetchError;
    }

    console.log(`[sla-escalation] Found ${pendingRequests?.length || 0} pending requests`);

    const now = new Date();
    const escalatedRequests: string[] = [];
    const notifiedRequests: string[] = [];

    for (const request of pendingRequests || []) {
      const absenceType = request.absence_types as any;
      const slaHours = absenceType?.sla_hours || 48; // Default 48 horas
      
      const createdAt = new Date(request.created_at);
      const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

      console.log(`[sla-escalation] Request ${request.id}: ${hoursElapsed.toFixed(1)}h elapsed, SLA: ${slaHours}h`);

      // 2. Verificar si ha superado el SLA
      if (hoursElapsed > slaHours) {
        // Obtener el último step de aprobación
        const { data: lastApproval } = await supabase
          .from('absence_approvals')
          .select('step')
          .eq('request_id', request.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const currentStep = lastApproval?.step || 0;
        const nextStep = currentStep + 1;

        // Determinar si escalar según approval_flow
        const approvalFlow = absenceType?.approval_flow || 'manager';
        let shouldEscalate = false;
        let nextApproverType = '';

        switch (approvalFlow) {
          case 'multi_level':
            if (nextStep <= 3) { // Máximo 3 niveles
              shouldEscalate = true;
              nextApproverType = nextStep === 1 ? 'manager' : nextStep === 2 ? 'admin' : 'super_admin';
            }
            break;
          case 'admin':
            if (currentStep === 0) {
              shouldEscalate = true;
              nextApproverType = 'admin';
            }
            break;
          case 'manager':
          default:
            if (currentStep === 0) {
              shouldEscalate = true;
              nextApproverType = 'manager';
            } else if (currentStep === 1) {
              shouldEscalate = true;
              nextApproverType = 'admin';
            }
            break;
        }

        if (shouldEscalate) {
          // Registrar escalado
          await supabase.from('absence_approvals').insert({
            request_id: request.id,
            approver_id: null, // Sistema
            action: 'escalate',
            notes: `Escalado automático por SLA vencido (${hoursElapsed.toFixed(1)}h > ${slaHours}h)`,
            step: nextStep
          });

          escalatedRequests.push(request.id);

          // Notificar al siguiente nivel
          // Obtener admins de la empresa
          const { data: admins } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['admin', 'super_admin']);

          for (const admin of admins || []) {
            // Verificar que pertenece a la misma empresa
            const { data: userCompany } = await supabase
              .from('user_companies')
              .select('id')
              .eq('user_id', admin.user_id)
              .eq('company_id', request.company_id)
              .single();

            if (userCompany) {
              await supabase.from('compliance_notifications').insert({
                company_id: request.company_id,
                notification_type: 'sla_escalation',
                recipient_user_id: admin.user_id,
                subject: `⚠️ Solicitud de ausencia escalada por SLA`,
                body_json: {
                  request_id: request.id,
                  employee_name: `${(request.employees as any)?.first_name} ${(request.employees as any)?.last_name}`,
                  absence_type: absenceType?.name,
                  dates: `${request.start_date} - ${request.end_date}`,
                  hours_elapsed: hoursElapsed.toFixed(1),
                  sla_hours: slaHours,
                  step: nextStep
                },
                channel: 'in_app'
              });
            }
          }

          // Registrar en audit_log
          await supabase.from('audit_log').insert({
            actor_type: 'system',
            action: 'absence_sla_escalation',
            entity_type: 'absence_request',
            entity_id: request.id,
            company_id: request.company_id,
            new_values: {
              hours_elapsed: hoursElapsed,
              sla_hours: slaHours,
              step: nextStep,
              next_approver_type: nextApproverType
            }
          });

          console.log(`[sla-escalation] Escalated request ${request.id} to step ${nextStep}`);
        }
      } else if (hoursElapsed > slaHours * 0.75) {
        // 3. Enviar recordatorio si está al 75% del SLA
        const reminderKey = `sla_reminder_${request.id}_${Math.floor(hoursElapsed / (slaHours * 0.25))}`;
        
        // Verificar si ya se envió este recordatorio
        const { data: existingReminder } = await supabase
          .from('compliance_notifications')
          .select('id')
          .eq('notification_type', 'sla_warning')
          .eq('company_id', request.company_id)
          .contains('body_json', { reminder_key: reminderKey })
          .single();

        if (!existingReminder) {
          // Obtener admins para notificar
          const { data: admins } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['admin', 'super_admin']);

          for (const admin of admins || []) {
            const { data: userCompany } = await supabase
              .from('user_companies')
              .select('id')
              .eq('user_id', admin.user_id)
              .eq('company_id', request.company_id)
              .single();

            if (userCompany) {
              await supabase.from('compliance_notifications').insert({
                company_id: request.company_id,
                notification_type: 'sla_warning',
                recipient_user_id: admin.user_id,
                subject: `⏰ Solicitud próxima a vencer SLA`,
                body_json: {
                  request_id: request.id,
                  employee_name: `${(request.employees as any)?.first_name} ${(request.employees as any)?.last_name}`,
                  absence_type: absenceType?.name,
                  hours_remaining: (slaHours - hoursElapsed).toFixed(1),
                  reminder_key: reminderKey
                },
                channel: 'in_app'
              });
            }
          }

          notifiedRequests.push(request.id);
          console.log(`[sla-escalation] Sent warning for request ${request.id}`);
        }
      }
    }

    console.log(`[sla-escalation] Completed. Escalated: ${escalatedRequests.length}, Warned: ${notifiedRequests.length}`);

    return new Response(JSON.stringify({
      success: true,
      processed: pendingRequests?.length || 0,
      escalated: escalatedRequests.length,
      escalated_ids: escalatedRequests,
      warned: notifiedRequests.length,
      warned_ids: notifiedRequests
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[sla-escalation] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
