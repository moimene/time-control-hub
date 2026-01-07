import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AbsenceApproveRequest {
  request_id: string;
  approver_id: string;
  action: 'approve' | 'reject' | 'escalate' | 'request_changes' | 'revoke';
  notes?: string;
  step?: number;
  override_coverage?: boolean;
  override_reason?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: AbsenceApproveRequest = await req.json();
    const { request_id, approver_id, action, notes, step = 1, override_coverage, override_reason } = body;

    console.log(`[absence-approve] Processing ${action} for request ${request_id} by ${approver_id}`);

    // 1. Obtener la solicitud con el tipo de ausencia
    const { data: request, error: requestError } = await supabase
      .from('absence_requests')
      .select(`
        *,
        absence_types (
          id, code, name, category, blocks_clocking, requires_justification,
          sla_hours, approval_flow
        ),
        employees (id, first_name, last_name, department, company_id)
      `)
      .eq('id', request_id)
      .single();

    if (requestError || !request) {
      console.error('[absence-approve] Request not found:', requestError);
      return new Response(
        JSON.stringify({ error: 'Solicitud no encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // 2. Validar estado actual
    if (request.status !== 'pending' && action !== 'revoke') {
      return new Response(
        JSON.stringify({ error: `No se puede ${action} una solicitud en estado ${request.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (action === 'revoke' && request.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Solo se pueden revocar solicitudes aprobadas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const absenceType = request.absence_types;
    const employee = request.employees;
    const companyId = employee?.company_id || request.company_id;

    // 3. Validar justificante si es requerido
    if (action === 'approve' && absenceType?.requires_justification) {
      const files = request.justification_files as any[];
      if (!files || files.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Se requiere justificante para aprobar esta solicitud' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    // 4. Verificar cobertura si se está aprobando
    let coverageResult = null;
    if (action === 'approve' && !override_coverage) {
      try {
        const coverageResponse = await supabase.functions.invoke('coverage-check', {
          body: {
            company_id: companyId,
            center_id: request.center_id,
            department: employee?.department,
            start_date: request.start_date,
            end_date: request.end_date,
            employee_id: request.employee_id
          }
        });
        coverageResult = coverageResponse.data;

        if (coverageResult && !coverageResult.can_approve) {
          // Obtener regla para verificar si permite override
          const { data: rule } = await supabase
            .from('coverage_rules')
            .select('approval_overrides')
            .eq('id', coverageResult.rule_id)
            .single();

          if (!rule?.approval_overrides) {
            return new Response(
              JSON.stringify({ 
                error: 'No se puede aprobar: conflicto de cobertura',
                coverage: coverageResult
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }
        }
      } catch (covError) {
        console.error('[absence-approve] Coverage check failed:', covError);
      }
    }

    // 5. Procesar la acción
    let newStatus = request.status;
    let balanceUpdated = false;
    let blockingEventsCreated = false;

    if (action === 'approve') {
      newStatus = 'approved';

      // Actualizar balance de vacaciones si aplica
      if (absenceType?.category === 'vacaciones' || absenceType?.code === 'VACACIONES') {
        const currentYear = new Date().getFullYear();
        
        // Obtener balance actual y actualizar
        const { data: currentBalance } = await supabase
          .from('vacation_balances')
          .select('used_days, pending_days')
          .eq('employee_id', request.employee_id)
          .eq('year', currentYear)
          .single();

        if (currentBalance) {
          const { error: balanceError } = await supabase
            .from('vacation_balances')
            .update({
              used_days: (currentBalance.used_days || 0) + request.total_days,
              pending_days: Math.max(0, (currentBalance.pending_days || 0) - request.total_days),
              updated_at: new Date().toISOString()
            })
            .eq('employee_id', request.employee_id)
            .eq('year', currentYear);

          if (!balanceError) {
            balanceUpdated = true;
          }
        }
        }

      // Marcar que se crean eventos de bloqueo (kiosk-clock ya verifica esto)
      if (absenceType?.blocks_clocking) {
        blockingEventsCreated = true;
      }

    } else if (action === 'reject') {
      newStatus = 'rejected';

      // Si estaba pendiente y era vacaciones, liberar pending_days
      if (absenceType?.category === 'vacaciones' || absenceType?.code === 'VACACIONES') {
        const currentYear = new Date().getFullYear();
        const { data: currentBalance } = await supabase
          .from('vacation_balances')
          .select('pending_days')
          .eq('employee_id', request.employee_id)
          .eq('year', currentYear)
          .single();

        if (currentBalance) {
          await supabase
            .from('vacation_balances')
            .update({
              pending_days: Math.max(0, (currentBalance.pending_days || 0) - request.total_days),
              updated_at: new Date().toISOString()
            })
            .eq('employee_id', request.employee_id)
            .eq('year', currentYear);
        }
      }

    } else if (action === 'escalate') {
      // Mantener pending pero incrementar step
      newStatus = 'pending';

    } else if (action === 'request_changes') {
      newStatus = 'pending';

    } else if (action === 'revoke') {
      newStatus = 'cancelled';

      // Devolver días al balance
      if (absenceType?.category === 'vacaciones' || absenceType?.code === 'VACACIONES') {
        const currentYear = new Date().getFullYear();
        const { data: currentBalance } = await supabase
          .from('vacation_balances')
          .select('used_days')
          .eq('employee_id', request.employee_id)
          .eq('year', currentYear)
          .single();

        if (currentBalance) {
          await supabase
            .from('vacation_balances')
            .update({
              used_days: Math.max(0, (currentBalance.used_days || 0) - request.total_days),
              updated_at: new Date().toISOString()
            })
            .eq('employee_id', request.employee_id)
            .eq('year', currentYear);
          balanceUpdated = true;
        }
      }
    }

    // 6. Actualizar la solicitud
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (action === 'revoke') {
      updateData.revoked_at = new Date().toISOString();
      updateData.revoked_by = approver_id;
      updateData.revoked_reason = notes || override_reason;
    }

    if (override_coverage && override_reason) {
      updateData.coverage_check = {
        ...(request.coverage_check as object || {}),
        override_applied: true,
        override_reason,
        override_by: approver_id,
        override_at: new Date().toISOString()
      };
    }

    const { error: updateError } = await supabase
      .from('absence_requests')
      .update(updateData)
      .eq('id', request_id);

    if (updateError) {
      console.error('[absence-approve] Update error:', updateError);
      throw updateError;
    }

    // 7. Registrar en absence_approvals
    await supabase.from('absence_approvals').insert({
      request_id,
      approver_id,
      action,
      notes: notes || override_reason,
      step
    });

    // 8. Registrar en audit_log
    await supabase.from('audit_log').insert({
      actor_id: approver_id,
      actor_type: 'admin',
      action: `absence_request_${action}`,
      entity_type: 'absence_request',
      entity_id: request_id,
      company_id: companyId,
      old_values: { status: request.status },
      new_values: { 
        status: newStatus,
        override_coverage,
        override_reason
      }
    });

    // 9. Crear notificación para el empleado
    const notificationMessages: Record<string, { title: string; message: string }> = {
      approve: { 
        title: 'Solicitud aprobada', 
        message: `Tu solicitud de ${absenceType?.name} del ${request.start_date} al ${request.end_date} ha sido aprobada` 
      },
      reject: { 
        title: 'Solicitud rechazada', 
        message: `Tu solicitud de ${absenceType?.name} del ${request.start_date} al ${request.end_date} ha sido rechazada${notes ? `: ${notes}` : ''}` 
      },
      escalate: { 
        title: 'Solicitud escalada', 
        message: `Tu solicitud de ${absenceType?.name} ha sido escalada para revisión adicional` 
      },
      request_changes: { 
        title: 'Cambios solicitados', 
        message: `Se requieren cambios en tu solicitud de ${absenceType?.name}${notes ? `: ${notes}` : ''}` 
      },
      revoke: { 
        title: 'Solicitud revocada', 
        message: `Tu ausencia aprobada de ${absenceType?.name} ha sido revocada${notes ? `: ${notes}` : ''}` 
      }
    };

    const notification = notificationMessages[action];
    if (notification) {
      await supabase.from('employee_notifications').insert({
        employee_id: request.employee_id,
        company_id: companyId,
        notification_type: `absence_${action}`,
        title: notification.title,
        message: notification.message,
        related_entity_type: 'absence_request',
        related_entity_id: request_id,
        action_url: '/employee/absences'
      });
    }

    // 10. Obtener balance actualizado para vacaciones
    let balance = null;
    if (balanceUpdated) {
      const currentYear = new Date().getFullYear();
      const { data: updatedBalance } = await supabase
        .from('vacation_balances')
        .select('*')
        .eq('employee_id', request.employee_id)
        .eq('year', currentYear)
        .single();
      balance = updatedBalance;
    }

    console.log(`[absence-approve] Successfully ${action} request ${request_id}, new status: ${newStatus}`);

    return new Response(JSON.stringify({
      status: newStatus,
      balance,
      blocking_events_created: blockingEventsCreated,
      coverage: coverageResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[absence-approve] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
