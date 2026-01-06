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

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { year, month } = await req.json();

    if (!year || !month) {
      return new Response(
        JSON.stringify({ error: 'Se requiere año y mes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate that the month is not the current or future month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (year > currentYear || (year === currentYear && month >= currentMonth)) {
      return new Response(
        JSON.stringify({ error: 'Solo se puede firmar el cierre del mes anterior o anteriores. El mes en curso no está disponible.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get employee record
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, company_id, first_name, last_name, employee_code')
      .eq('user_id', user.id)
      .single();

    if (empError || !employee) {
      console.error('Employee lookup error:', empError);
      return new Response(
        JSON.stringify({ error: 'Empleado no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if closure already exists and is signed
    const { data: existingClosure } = await supabase
      .from('monthly_closures')
      .select('id, status')
      .eq('employee_id', employee.id)
      .eq('year', year)
      .eq('month', month)
      .single();

    if (existingClosure?.status === 'signed') {
      return new Response(
        JSON.stringify({ error: 'Este mes ya ha sido firmado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate hours for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const { data: timeEvents, error: eventsError } = await supabase
      .from('time_events')
      .select('*')
      .eq('employee_id', employee.id)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: true });

    if (eventsError) {
      console.error('Time events fetch error:', eventsError);
      return new Response(
        JSON.stringify({ error: 'Error al obtener registros de fichaje' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate totals
    let totalMinutes = 0;
    let regularMinutes = 0;
    let overtimeMinutes = 0;
    let nightMinutes = 0;
    const dailySummary: Record<string, any> = {};

    // Pair entry/exit events
    for (let i = 0; i < (timeEvents?.length || 0); i++) {
      const event = timeEvents![i];
      if (event.event_type === 'entry' && i + 1 < timeEvents!.length) {
        const nextEvent = timeEvents![i + 1];
        if (nextEvent.event_type === 'exit') {
          const entryTime = new Date(event.timestamp);
          const exitTime = new Date(nextEvent.timestamp);
          const minutes = (exitTime.getTime() - entryTime.getTime()) / (1000 * 60);
          
          totalMinutes += minutes;
          
          // Check for night hours (22:00-06:00)
          const entryHour = entryTime.getHours();
          const exitHour = exitTime.getHours();
          if (entryHour >= 22 || entryHour < 6 || exitHour >= 22 || exitHour < 6) {
            nightMinutes += Math.min(minutes, 480); // Cap at 8 hours
          }
          
          // Daily summary
          const dateKey = entryTime.toISOString().split('T')[0];
          if (!dailySummary[dateKey]) {
            dailySummary[dateKey] = { hours: 0, events: [] };
          }
          dailySummary[dateKey].hours += minutes / 60;
          dailySummary[dateKey].events.push({
            entry: event.timestamp,
            exit: nextEvent.timestamp
          });
          
          i++; // Skip the exit event
        }
      }
    }

    // Calculate regular vs overtime (>8h/day = overtime)
    const dailyRegularLimit = 480; // 8 hours in minutes
    Object.values(dailySummary).forEach((day: any) => {
      const dayMinutes = day.hours * 60;
      if (dayMinutes > dailyRegularLimit) {
        regularMinutes += dailyRegularLimit;
        overtimeMinutes += dayMinutes - dailyRegularLimit;
      } else {
        regularMinutes += dayMinutes;
      }
    });

    // Generate signature hash
    const signatureData = {
      employee_id: employee.id,
      year,
      month,
      total_hours: totalMinutes / 60,
      regular_hours: regularMinutes / 60,
      overtime_hours: overtimeMinutes / 60,
      signed_at: new Date().toISOString(),
      events_count: timeEvents?.length || 0
    };
    
    const encoder = new TextEncoder();
    const signatureBuffer = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(JSON.stringify(signatureData))
    );
    const signatureHash = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Create or update monthly closure
    const closureData = {
      company_id: employee.company_id,
      employee_id: employee.id,
      year,
      month,
      total_hours: totalMinutes / 60,
      regular_hours: regularMinutes / 60,
      overtime_hours: overtimeMinutes / 60,
      night_hours: nightMinutes / 60,
      summary_json: {
        daily_summary: dailySummary,
        events_count: timeEvents?.length || 0,
        calculation_date: new Date().toISOString()
      },
      status: 'signed',
      signed_at: new Date().toISOString(),
      signature_hash: signatureHash
    };

    let closureId: string;
    
    if (existingClosure) {
      const { error: updateError } = await supabase
        .from('monthly_closures')
        .update(closureData)
        .eq('id', existingClosure.id);
      
      if (updateError) throw updateError;
      closureId = existingClosure.id;
    } else {
      const { data: newClosure, error: insertError } = await supabase
        .from('monthly_closures')
        .insert(closureData)
        .select('id')
        .single();
      
      if (insertError) throw insertError;
      closureId = newClosure.id;
    }

    // Trigger QTSP notarization for the signed closure
    try {
      // Get or create case file for company
      let caseFile = await supabase
        .from('dt_case_files')
        .select('id')
        .eq('company_id', employee.company_id)
        .single();

      if (!caseFile.data) {
        // Create case file if doesn't exist
        const { data: company } = await supabase
          .from('company')
          .select('name, cif')
          .eq('id', employee.company_id)
          .single();

        const { data: newCaseFile } = await supabase
          .from('dt_case_files')
          .insert({
            company_id: employee.company_id,
            external_id: `CF-${employee.company_id}`,
            name: `Expediente ${company?.name || 'Empresa'}`,
            description: `Expediente de custodia de evidencias para ${company?.name || 'la empresa'}`
          })
          .select('id')
          .single();
        
        if (newCaseFile) {
          caseFile = { data: newCaseFile, error: null, count: null, status: 200, statusText: 'OK' };
        }
      }

      if (caseFile.data) {
        // Get or create evidence group for this month
        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
        let evidenceGroup = await supabase
          .from('dt_evidence_groups')
          .select('id')
          .eq('case_file_id', caseFile.data.id)
          .eq('year_month', yearMonth)
          .single();

        if (!evidenceGroup.data) {
          const { data: newGroup } = await supabase
            .from('dt_evidence_groups')
            .insert({
              case_file_id: caseFile.data.id,
              external_id: `EG-${yearMonth}`,
              name: `Evidencias ${yearMonth}`,
              year_month: yearMonth
            })
            .select('id')
            .single();
          
          if (newGroup) {
            evidenceGroup = { data: newGroup, error: null, count: null, status: 200, statusText: 'OK' };
          }
        }

        if (evidenceGroup.data) {
          // Create evidence for this signed closure
          const { data: evidence } = await supabase
            .from('dt_evidences')
            .insert({
              evidence_group_id: evidenceGroup.data.id,
              evidence_type: 'monthly_report',
              report_month: yearMonth,
              status: 'pending'
            })
            .select('id')
            .single();

          if (evidence) {
            // Update closure with evidence reference
            await supabase
              .from('monthly_closures')
              .update({ evidence_id: evidence.id })
              .eq('id', closureId);

            // Trigger QTSP notarization
            await supabase.functions.invoke('qtsp-notarize', {
              body: { evidenceId: evidence.id }
            });
          }
        }
      }
    } catch (qtspError) {
      console.error('QTSP notarization error (non-blocking):', qtspError);
      // Don't fail the signature if QTSP fails
    }

    // Create notification for employee
    await supabase.from('employee_notifications').insert({
      company_id: employee.company_id,
      employee_id: employee.id,
      notification_type: 'closure_signed',
      title: 'Cierre mensual firmado',
      message: `Has firmado correctamente el cierre de horas de ${getMonthName(month)} ${year}. Total: ${(totalMinutes / 60).toFixed(2)} horas.`,
      related_entity_type: 'monthly_closure',
      related_entity_id: closureId
    });

    // Log the action
    await supabase.from('audit_log').insert({
      actor_type: 'employee',
      actor_id: user.id,
      action: 'sign_monthly_closure',
      entity_type: 'monthly_closure',
      entity_id: closureId,
      company_id: employee.company_id,
      new_values: {
        year,
        month,
        total_hours: totalMinutes / 60,
        signature_hash: signatureHash
      }
    });

    console.log(`Monthly closure signed for employee ${employee.id}: ${year}-${month}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cierre mensual firmado correctamente',
        data: {
          closure_id: closureId,
          total_hours: totalMinutes / 60,
          regular_hours: regularMinutes / 60,
          overtime_hours: overtimeMinutes / 60,
          night_hours: nightMinutes / 60,
          signature_hash: signatureHash
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sign-monthly-hours:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getMonthName(month: number): string {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  return months[month - 1] || '';
}
