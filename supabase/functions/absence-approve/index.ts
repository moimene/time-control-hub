import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import {
  jsonResponse,
  requireAnyRole,
  requireCallerContext,
  requireCompanyAccess,
} from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

// Helper para generar hash del payload
async function hashPayload(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface AbsenceApproveRequest {
  request_id: string;
  action:
    | 'approve'
    | 'approved'
    | 'reject'
    | 'rejected'
    | 'escalate'
    | 'escalated'
    | 'request_changes'
    | 'revoke';
  notes?: string;
  step?: number;
  override_coverage?: boolean;
  override_reason?: string;
  // Legacy input (ignored). Approver is derived from the authenticated caller.
  approver_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const bodyText = await req.text();
    const body: AbsenceApproveRequest = JSON.parse(bodyText);
    const caller = await requireCallerContext({ req, supabaseAdmin: supabase, corsHeaders });
    if (caller instanceof Response) return caller;
    if (caller.kind !== 'user') {
      return jsonResponse({ error: 'Unauthorized caller' }, 401, corsHeaders);
    }
    const roleError = requireAnyRole({
      ctx: caller,
      allowed: ['super_admin', 'admin', 'responsible'],
      corsHeaders,
    });
    if (roleError) return roleError;

    const { request_id, notes, step = 1, override_coverage, override_reason } = body;

    if (!request_id) {
      return jsonResponse({ error: 'request_id is required' }, 400, corsHeaders);
    }

    const actionMap: Record<string, AbsenceApproveRequest['action']> = {
      approve: 'approve',
      approved: 'approve',
      reject: 'reject',
      rejected: 'reject',
      escalate: 'escalate',
      escalated: 'escalate',
      request_changes: 'request_changes',
      revoke: 'revoke',
    };
    const rawAction = body.action;
    const action = actionMap[rawAction] || rawAction;
    const approver_id = caller.userId;

    // Verificar idempotencia
    const idempotencyKey = req.headers.get('idempotency-key');
    if (idempotencyKey) {
      const payloadHash = await hashPayload(bodyText);
      
      const { data: existingKey } = await supabase
        .from('idempotency_keys')
        .select('response_status, response_body')
        .eq('idempotency_key', idempotencyKey)
        .eq('endpoint', 'absence-approve')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (existingKey) {
        console.log(`[absence-approve] Returning cached response for idempotency key: ${idempotencyKey}`);
        return new Response(
          JSON.stringify(existingKey.response_body),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: existingKey.response_status || 200 
          }
        );
      }
    }

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
    if (!companyId) {
      return jsonResponse({ error: 'Unable to resolve company_id for request' }, 400, corsHeaders);
    }

    const companyAccess = await requireCompanyAccess({
      supabaseAdmin: supabase,
      ctx: caller,
      companyId,
      corsHeaders,
      allowEmployee: true,
    });
    if (companyAccess instanceof Response) return companyAccess;

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

    const responseBody = {
      status: newStatus,
      balance,
      blocking_events_created: blockingEventsCreated,
      coverage: coverageResult
    };

    // Guardar idempotency key si existe
    if (idempotencyKey) {
      await supabase.from('idempotency_keys').insert({
        idempotency_key: idempotencyKey,
        endpoint: 'absence-approve',
        payload_hash: await hashPayload(bodyText),
        response_status: 200,
        response_body: responseBody
      });
    }

    return new Response(JSON.stringify(responseBody), {
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
