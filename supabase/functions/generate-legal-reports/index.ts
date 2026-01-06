import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportRequest {
  company_id: string;
  report_type: 'overtime' | 'breaks' | 'night_work';
  month: string; // YYYY-MM format
  employee_id?: string; // Optional: specific employee
}

interface TimeEvent {
  id: string;
  employee_id: string;
  event_type: 'entry' | 'exit';
  timestamp: string;
  local_timestamp: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  department: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { company_id, report_type, month, employee_id } = await req.json() as ReportRequest;

    if (!company_id || !report_type || !month) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating ${report_type} report for company ${company_id}, month ${month}`);

    // Parse month
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    // Fetch employees
    let employeeQuery = supabase
      .from('employees')
      .select('id, first_name, last_name, employee_code, department')
      .eq('company_id', company_id)
      .eq('status', 'active');

    if (employee_id) {
      employeeQuery = employeeQuery.eq('id', employee_id);
    }

    const { data: employees, error: empError } = await employeeQuery;
    if (empError) throw empError;

    // Fetch time events for the month
    const { data: timeEvents, error: teError } = await supabase
      .from('time_events')
      .select('id, employee_id, event_type, timestamp, local_timestamp')
      .eq('company_id', company_id)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: true });

    if (teError) throw teError;

    // Generate report based on type
    let reportData: any;
    let reportTitle: string;

    switch (report_type) {
      case 'overtime':
        reportData = generateOvertimeReport(employees || [], timeEvents || [], month);
        reportTitle = `Informe de Horas Extraordinarias - ${month}`;
        break;
      case 'breaks':
        reportData = generateBreaksReport(employees || [], timeEvents || [], month);
        reportTitle = `Informe de Pausas Intrajornada - ${month}`;
        break;
      case 'night_work':
        reportData = generateNightWorkReport(employees || [], timeEvents || [], month);
        reportTitle = `Informe de Trabajo Nocturno - ${month}`;
        break;
      default:
        throw new Error(`Unknown report type: ${report_type}`);
    }

    // Get or create case file for company
    let { data: caseFile } = await supabase
      .from('dt_case_files')
      .select('id')
      .eq('company_id', company_id)
      .maybeSingle();

    if (!caseFile) {
      const { data: company } = await supabase
        .from('company')
        .select('name')
        .eq('id', company_id)
        .single();

      const { data: newCaseFile, error: cfError } = await supabase
        .from('dt_case_files')
        .insert({
          company_id,
          name: `Expediente ${company?.name || company_id}`,
          external_id: `cf_${company_id.substring(0, 8)}`,
        })
        .select()
        .single();

      if (cfError) throw cfError;
      caseFile = newCaseFile;
    }

    if (!caseFile) {
      throw new Error('Could not create or find case file');
    }

    // Get or create evidence group for this month
    let { data: evidenceGroup } = await supabase
      .from('dt_evidence_groups')
      .select('id')
      .eq('case_file_id', caseFile.id)
      .eq('year_month', month)
      .maybeSingle();

    if (!evidenceGroup) {
      const { data: newGroup, error: egError } = await supabase
        .from('dt_evidence_groups')
        .insert({
          case_file_id: caseFile.id,
          year_month: month,
          name: `Evidencias ${month}`,
          external_id: `eg_${month}_${Date.now()}`,
        })
        .select()
        .single();

      if (egError) throw egError;
      evidenceGroup = newGroup;
    }

    if (!evidenceGroup) {
      throw new Error('Could not create or find evidence group');
    }

    // Create evidence record
    const evidenceType = `${report_type}_report` as 'overtime_report' | 'breaks_report' | 'night_work_report';
    const { data: evidence, error: evError } = await supabase
      .from('dt_evidences')
      .insert({
        evidence_group_id: evidenceGroup.id,
        evidence_type: evidenceType,
        report_month: month,
        status: 'pending',
        signature_data: {
          report_type,
          title: reportTitle,
          generated_at: new Date().toISOString(),
          data: reportData,
        },
      })
      .select()
      .single();

    if (evError) throw evError;

    // Trigger QTSP notarization
    const notarizeResponse = await supabase.functions.invoke('qtsp-notarize', {
      body: {
        action: 'notarize_legal_report',
        company_id,
        evidence_id: evidence.id,
        report_type,
        report_title: reportTitle,
        report_data: reportData,
      },
    });

    if (notarizeResponse.error) {
      console.error('Notarization error:', notarizeResponse.error);
    }

    // Log in qtsp_audit_log
    await supabase.from('qtsp_audit_log').insert({
      company_id,
      evidence_id: evidence.id,
      action: `generate_${report_type}_report`,
      status: notarizeResponse.error ? 'error' : 'success',
      request_payload: { report_type, month, employee_id },
      error_message: notarizeResponse.error?.message,
    });

    return new Response(
      JSON.stringify({
        success: true,
        evidence_id: evidence.id,
        report_title: reportTitle,
        report_data: reportData,
        message: `Informe de ${report_type} generado correctamente`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating legal report:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Calculate working hours from time events
function calculateWorkingHours(events: TimeEvent[]): number {
  let totalMinutes = 0;
  let entryTime: Date | null = null;

  for (const event of events) {
    if (event.event_type === 'entry') {
      entryTime = new Date(event.timestamp);
    } else if (event.event_type === 'exit' && entryTime) {
      const exitTime = new Date(event.timestamp);
      totalMinutes += (exitTime.getTime() - entryTime.getTime()) / (1000 * 60);
      entryTime = null;
    }
  }

  return totalMinutes / 60; // Return hours
}

// Generate overtime report
function generateOvertimeReport(employees: Employee[], timeEvents: TimeEvent[], month: string) {
  const STANDARD_DAILY_HOURS = 8;
  const employeeData: any[] = [];
  let totalOvertimeHours = 0;

  for (const emp of employees) {
    const empEvents = timeEvents.filter(e => e.employee_id === emp.id);
    
    // Group by date
    const eventsByDate = new Map<string, TimeEvent[]>();
    for (const event of empEvents) {
      const date = event.local_timestamp.split('T')[0];
      if (!eventsByDate.has(date)) eventsByDate.set(date, []);
      eventsByDate.get(date)!.push(event);
    }

    let employeeOvertime = 0;
    const dailyDetails: any[] = [];

    for (const [date, events] of eventsByDate) {
      const workedHours = calculateWorkingHours(events);
      const overtime = Math.max(0, workedHours - STANDARD_DAILY_HOURS);
      
      if (overtime > 0) {
        employeeOvertime += overtime;
        dailyDetails.push({
          date,
          worked_hours: workedHours.toFixed(2),
          overtime_hours: overtime.toFixed(2),
        });
      }
    }

    if (employeeOvertime > 0) {
      totalOvertimeHours += employeeOvertime;
      employeeData.push({
        employee_code: emp.employee_code,
        name: `${emp.first_name} ${emp.last_name}`,
        department: emp.department || 'Sin departamento',
        total_overtime_hours: employeeOvertime.toFixed(2),
        days_with_overtime: dailyDetails.length,
        details: dailyDetails,
      });
    }
  }

  return {
    report_month: month,
    standard_daily_hours: STANDARD_DAILY_HOURS,
    total_employees_with_overtime: employeeData.length,
    total_overtime_hours: totalOvertimeHours.toFixed(2),
    employees: employeeData,
    legal_reference: 'Art. 35 Estatuto de los Trabajadores - Horas extraordinarias',
    generated_at: new Date().toISOString(),
  };
}

// Generate breaks report
function generateBreaksReport(employees: Employee[], timeEvents: TimeEvent[], month: string) {
  const MIN_CONTINUOUS_WORK_FOR_BREAK = 6; // hours
  const REQUIRED_BREAK_MINUTES = 15; // minimum break
  const employeeData: any[] = [];
  let totalViolations = 0;

  for (const emp of employees) {
    const empEvents = timeEvents.filter(e => e.employee_id === emp.id);
    
    // Group by date
    const eventsByDate = new Map<string, TimeEvent[]>();
    for (const event of empEvents) {
      const date = event.local_timestamp.split('T')[0];
      if (!eventsByDate.has(date)) eventsByDate.set(date, []);
      eventsByDate.get(date)!.push(event);
    }

    const violations: any[] = [];

    for (const [date, events] of eventsByDate) {
      // Sort events by timestamp
      events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      // Check for continuous work periods without breaks
      let currentWorkStart: Date | null = null;
      let hadBreak = false;

      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        
        if (event.event_type === 'entry') {
          if (!currentWorkStart) {
            currentWorkStart = new Date(event.timestamp);
          }
        } else if (event.event_type === 'exit' && currentWorkStart) {
          const exitTime = new Date(event.timestamp);
          const workHours = (exitTime.getTime() - currentWorkStart.getTime()) / (1000 * 60 * 60);
          
          // Check if next event is an entry (break scenario)
          const nextEvent = events[i + 1];
          if (nextEvent && nextEvent.event_type === 'entry') {
            const breakMinutes = (new Date(nextEvent.timestamp).getTime() - exitTime.getTime()) / (1000 * 60);
            if (breakMinutes >= REQUIRED_BREAK_MINUTES) {
              hadBreak = true;
            }
          }
          
          // If worked more than 6 hours without proper break, it's a violation
          if (workHours >= MIN_CONTINUOUS_WORK_FOR_BREAK && !hadBreak) {
            violations.push({
              date,
              continuous_work_hours: workHours.toFixed(2),
              break_taken: false,
            });
            totalViolations++;
          }
          
          currentWorkStart = null;
          hadBreak = false;
        }
      }
    }

    if (violations.length > 0) {
      employeeData.push({
        employee_code: emp.employee_code,
        name: `${emp.first_name} ${emp.last_name}`,
        department: emp.department || 'Sin departamento',
        violations_count: violations.length,
        details: violations,
      });
    }
  }

  return {
    report_month: month,
    min_continuous_work_for_break_hours: MIN_CONTINUOUS_WORK_FOR_BREAK,
    required_break_minutes: REQUIRED_BREAK_MINUTES,
    total_violations: totalViolations,
    employees_with_violations: employeeData.length,
    employees: employeeData,
    legal_reference: 'Art. 34.4 Estatuto de los Trabajadores - Descanso intrajornada',
    generated_at: new Date().toISOString(),
  };
}

// Generate night work report
function generateNightWorkReport(employees: Employee[], timeEvents: TimeEvent[], month: string) {
  const NIGHT_START_HOUR = 22; // 10 PM
  const NIGHT_END_HOUR = 6; // 6 AM
  const employeeData: any[] = [];
  let totalNightHours = 0;

  for (const emp of employees) {
    const empEvents = timeEvents.filter(e => e.employee_id === emp.id);
    
    // Group by date
    const eventsByDate = new Map<string, TimeEvent[]>();
    for (const event of empEvents) {
      const date = event.local_timestamp.split('T')[0];
      if (!eventsByDate.has(date)) eventsByDate.set(date, []);
      eventsByDate.get(date)!.push(event);
    }

    let employeeNightHours = 0;
    const dailyDetails: any[] = [];

    for (const [date, events] of eventsByDate) {
      let entryTime: Date | null = null;
      let dayNightMinutes = 0;

      for (const event of events) {
        if (event.event_type === 'entry') {
          entryTime = new Date(event.timestamp);
        } else if (event.event_type === 'exit' && entryTime) {
          const exitTime = new Date(event.timestamp);
          
          // Calculate night hours in this period
          let current = new Date(entryTime);
          while (current < exitTime) {
            const hour = current.getHours();
            if (hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR) {
              dayNightMinutes++;
            }
            current = new Date(current.getTime() + 60000); // Add 1 minute
          }
          
          entryTime = null;
        }
      }

      const nightHours = dayNightMinutes / 60;
      if (nightHours > 0) {
        employeeNightHours += nightHours;
        dailyDetails.push({
          date,
          night_hours: nightHours.toFixed(2),
        });
      }
    }

    if (employeeNightHours > 0) {
      totalNightHours += employeeNightHours;
      employeeData.push({
        employee_code: emp.employee_code,
        name: `${emp.first_name} ${emp.last_name}`,
        department: emp.department || 'Sin departamento',
        total_night_hours: employeeNightHours.toFixed(2),
        days_with_night_work: dailyDetails.length,
        details: dailyDetails,
      });
    }
  }

  return {
    report_month: month,
    night_period: `${NIGHT_START_HOUR}:00 - ${NIGHT_END_HOUR}:00`,
    total_employees_with_night_work: employeeData.length,
    total_night_hours: totalNightHours.toFixed(2),
    employees: employeeData,
    legal_reference: 'Art. 36 Estatuto de los Trabajadores - Trabajo nocturno',
    generated_at: new Date().toISOString(),
  };
}
