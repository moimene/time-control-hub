import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AbsenceCreateRequest {
  company_id: string;
  employee_id: string;
  absence_type_id: string;
  start_date: string;
  end_date: string;
  start_half_day?: boolean;
  end_half_day?: boolean;
  total_hours?: number;
  reason?: string;
  justification_files?: string[];
  justification_meta?: Record<string, any>;
  travel_km?: number;
  origin?: 'employee' | 'admin';
  center_id?: string;
}

interface AbsenceType {
  id: string;
  code: string;
  name: string;
  category: string;
  compute_on: string;
  duration_value: number | null;
  duration_unit: string | null;
  is_active: boolean;
  requires_justification: boolean;
  requires_approval: boolean;
  advance_notice_days: number | null;
  extra_travel_days: number | null;
  travel_threshold_km: number | null;
  half_day_allowed: boolean | null;
  blocks_clocking: boolean | null;
  max_days_per_year: number | null;
  incompatible_with: string[] | null;
  is_paid: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: AbsenceCreateRequest = await req.json();
    const {
      company_id, employee_id, absence_type_id, start_date, end_date,
      start_half_day, end_half_day, total_hours, reason,
      justification_files, justification_meta, travel_km,
      origin = 'employee', center_id
    } = body;

    console.log(`[absence-create] Creating absence for employee ${employee_id}, type ${absence_type_id}`);

    const warnings: string[] = [];

    // 1. Obtener tipo de ausencia
    const { data: absenceType, error: typeError } = await supabase
      .from('absence_types')
      .select('*')
      .eq('id', absence_type_id)
      .eq('company_id', company_id)
      .single();

    if (typeError || !absenceType) {
      console.error('[absence-create] Absence type not found:', typeError);
      return new Response(
        JSON.stringify({ error: 'Tipo de ausencia no encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const type = absenceType as AbsenceType;

    // 2. Validar que el tipo esté activo
    if (!type.is_active) {
      return new Response(
        JSON.stringify({ error: 'Este tipo de ausencia no está activo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 3. Validar preaviso mínimo
    if (type.advance_notice_days && type.advance_notice_days > 0) {
      const today = new Date();
      const requestStart = new Date(start_date);
      const daysDiff = Math.ceil((requestStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff < type.advance_notice_days && origin !== 'admin') {
        return new Response(
          JSON.stringify({ 
            error: `Se requiere un preaviso mínimo de ${type.advance_notice_days} días para este tipo de ausencia` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      } else if (daysDiff < type.advance_notice_days) {
        warnings.push(`Preaviso mínimo no cumplido (${type.advance_notice_days} días requeridos)`);
      }
    }

    // 4. Calcular días según compute_on
    let totalDays = 0;
    let extraTravelDays = 0;
    const startD = new Date(start_date);
    const endD = new Date(end_date);

    if (type.compute_on === 'dias_naturales' || type.compute_on === 'natural') {
      // Días naturales: contar todos los días
      totalDays = Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else if (type.compute_on === 'dias_laborables' || type.compute_on === 'laborable') {
      // Días laborables: excluir fines de semana y festivos
      const { data: holidays } = await supabase
        .from('calendar_holidays')
        .select('holiday_date')
        .eq('company_id', company_id)
        .gte('holiday_date', start_date)
        .lte('holiday_date', end_date);

      const holidayDates = new Set((holidays || []).map(h => h.holiday_date));
      
      for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        const dateStr = d.toISOString().split('T')[0];
        
        // Excluir sábado (6) y domingo (0), y festivos
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
          totalDays++;
        }
      }
    } else if (type.compute_on === 'horas') {
      // Por horas
      if (!total_hours) {
        return new Response(
          JSON.stringify({ error: 'Se requiere especificar las horas para este tipo de ausencia' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      totalDays = total_hours / 8; // Asumimos jornada de 8h
    }

    // Ajustar por medio día
    if (start_half_day && type.half_day_allowed) {
      totalDays -= 0.5;
    }
    if (end_half_day && type.half_day_allowed) {
      totalDays -= 0.5;
    }

    // 5. Calcular días extra por desplazamiento
    if (travel_km && type.travel_threshold_km && type.extra_travel_days) {
      if (travel_km >= type.travel_threshold_km) {
        extraTravelDays = type.extra_travel_days;
        totalDays += extraTravelDays;
        console.log(`[absence-create] Adding ${extraTravelDays} travel days for ${travel_km}km`);
      }
    }

    // 6. Validar saldo para vacaciones
    if (type.category === 'vacaciones' || type.code === 'VACACIONES') {
      const currentYear = new Date().getFullYear();
      
      const { data: balance } = await supabase
        .from('vacation_balances')
        .select('*')
        .eq('employee_id', employee_id)
        .eq('year', currentYear)
        .single();

      if (balance) {
        const availableDays = (balance.entitled_days || 0) + (balance.carried_over_days || 0) 
          - (balance.used_days || 0) - (balance.pending_days || 0);
        
        if (totalDays > availableDays && origin !== 'admin') {
          return new Response(
            JSON.stringify({ 
              error: `Saldo insuficiente. Disponible: ${availableDays} días, Solicitado: ${totalDays} días` 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        } else if (totalDays > availableDays) {
          warnings.push(`Saldo insuficiente (disponible: ${availableDays}, solicitado: ${totalDays})`);
        }
      }
    }

    // 7. Verificar solapamiento con suspensiones activas
    const { data: overlappingSuspensions } = await supabase
      .from('absence_requests')
      .select('id, absence_type_id, start_date, end_date, absence_types!inner(category)')
      .eq('employee_id', employee_id)
      .eq('status', 'approved')
      .eq('absence_types.category', 'suspension')
      .lte('start_date', end_date)
      .gte('end_date', start_date);

    if (overlappingSuspensions && overlappingSuspensions.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No se puede solicitar esta ausencia porque existe una suspensión activa en las fechas seleccionadas' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 8. Verificar incompatibilidades
    if (type.incompatible_with && Array.isArray(type.incompatible_with) && type.incompatible_with.length > 0) {
      const { data: incompatibleAbsences } = await supabase
        .from('absence_requests')
        .select('id, absence_type_id, absence_types!inner(code)')
        .eq('employee_id', employee_id)
        .in('status', ['pending', 'approved'])
        .lte('start_date', end_date)
        .gte('end_date', start_date);

      const hasIncompatible = incompatibleAbsences?.some(abs => 
        type.incompatible_with?.includes((abs as any).absence_types?.code)
      );

      if (hasIncompatible) {
        return new Response(
          JSON.stringify({ 
            error: 'Ya existe una ausencia incompatible en las fechas seleccionadas' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    // 9. Verificar justificante requerido
    const justificationRequired = type.requires_justification;
    if (justificationRequired && (!justification_files || justification_files.length === 0)) {
      warnings.push('Este tipo de ausencia requiere justificante para ser aprobada');
    }

    // 10. Llamar a coverage-check
    let coverageResult = null;
    try {
      const coverageResponse = await supabase.functions.invoke('coverage-check', {
        body: {
          company_id,
          center_id,
          department: null,
          start_date,
          end_date,
          employee_id
        }
      });
      coverageResult = coverageResponse.data;
      
      if (coverageResult && !coverageResult.can_approve) {
        warnings.push('La solicitud puede generar conflictos de cobertura');
      }
    } catch (covError) {
      console.error('[absence-create] Coverage check failed:', covError);
    }

    // 11. Crear la solicitud
    const { data: request, error: insertError } = await supabase
      .from('absence_requests')
      .insert({
        company_id,
        employee_id,
        absence_type_id,
        center_id,
        start_date,
        end_date,
        start_half_day: start_half_day || false,
        end_half_day: end_half_day || false,
        total_days: totalDays,
        total_hours: total_hours || (totalDays * 8),
        extra_days_applied: extraTravelDays,
        travel_km: travel_km || null,
        reason,
        status: type.requires_approval ? 'pending' : 'approved',
        justification_required: justificationRequired,
        justification_files: justification_files || [],
        justification_meta: justification_meta || {},
        coverage_check: coverageResult,
        origin,
        tz: 'Europe/Madrid'
      })
      .select()
      .single();

    if (insertError) {
      console.error('[absence-create] Insert error:', insertError);
      throw insertError;
    }

    console.log(`[absence-create] Created request ${request.id} with status ${request.status}`);

    // 12. Si no requiere aprobación, actualizar balance de vacaciones
    if (!type.requires_approval && (type.category === 'vacaciones' || type.code === 'VACACIONES')) {
      const currentYear = new Date().getFullYear();
      await supabase
        .from('vacation_balances')
        .update({
          used_days: supabase.rpc('increment_used_days', { days: totalDays }),
          updated_at: new Date().toISOString()
        })
        .eq('employee_id', employee_id)
        .eq('year', currentYear);
    }

    // 13. Registrar en audit_log
    await supabase.from('audit_log').insert({
      actor_id: employee_id,
      actor_type: origin === 'admin' ? 'admin' : 'employee',
      action: 'absence_request_created',
      entity_type: 'absence_request',
      entity_id: request.id,
      company_id,
      new_values: {
        absence_type: type.code,
        start_date,
        end_date,
        total_days: totalDays,
        status: request.status
      }
    });

    return new Response(JSON.stringify({
      request_id: request.id,
      status: request.status,
      precompute: {
        total_days: totalDays,
        total_hours: total_hours || (totalDays * 8),
        extra_days_travel: extraTravelDays,
        coverage: coverageResult
      },
      warnings
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201
    });

  } catch (error) {
    console.error('[absence-create] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
