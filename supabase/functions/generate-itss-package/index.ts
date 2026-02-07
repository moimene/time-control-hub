import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ITSSRequest {
  company_id: string;
  period_start: string;
  period_end: string;
  expedient_number?: string;
  request_date?: string;
  contact_person?: string;
  centers?: string[];
  components: {
    daily_record: boolean;
    labor_calendar: boolean;
    policies: boolean;
    contract_summary: boolean;
    annexes?: string[];
  };
  dry_run?: boolean;
}

interface DailyRecord {
  company_id: string;
  company_name: string;
  center_id: string | null;
  center_name: string | null;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  nif: string | null;
  date: string;
  entry_time: string | null;
  exit_time: string | null;
  daily_worked_minutes: number;
  event_count: number;
  terminal_id: string | null;
  terminal_name: string | null;
  auth_factor: string;
  origin: string;
  correction_flag: boolean;
  correction_reason: string | null;
  audit_ref: string | null;
}

type AppRole = 'super_admin' | 'admin' | 'responsible' | 'employee' | 'asesor';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function authorizeCompanyAccess(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  companyId: string
): Promise<{ userId: string; roles: AppRole[] } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ success: false, error: 'Missing Authorization header' }, 401);
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return jsonResponse({ success: false, error: 'Invalid Authorization token' }, 401);
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    return jsonResponse({ success: false, error: 'Unauthorized user' }, 401);
  }

  const userId = authData.user.id;
  const { data: roleRows, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (roleError) {
    throw new Error(`Unable to resolve user roles: ${roleError.message}`);
  }

  const roles = (roleRows || []).map(r => r.role as AppRole);
  const isPrivileged = roles.some(role =>
    ['super_admin', 'admin', 'responsible', 'asesor'].includes(role)
  );

  if (!isPrivileged) {
    return jsonResponse({ success: false, error: 'Insufficient permissions' }, 403);
  }

  if (roles.includes('super_admin')) {
    return { userId, roles };
  }

  const { data: linkedCompany, error: linkedCompanyError } = await supabase
    .from('user_company')
    .select('company_id')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .maybeSingle();

  if (linkedCompanyError) {
    throw new Error(`Unable to validate user-company link: ${linkedCompanyError.message}`);
  }

  const { data: linkedEmployee, error: linkedEmployeeError } = await supabase
    .from('employees')
    .select('company_id')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .maybeSingle();

  if (linkedEmployeeError) {
    throw new Error(`Unable to validate employee-company link: ${linkedEmployeeError.message}`);
  }

  if (!linkedCompany && !linkedEmployee) {
    return jsonResponse({ success: false, error: 'User not assigned to requested company' }, 403);
  }

  return { userId, roles };
}

async function computeHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body: ITSSRequest = await req.json();
    const { 
      company_id, 
      period_start, 
      period_end, 
      expedient_number,
      request_date,
      contact_person,
      centers,
      components,
      dry_run = false 
    } = body;

    if (!company_id || !period_start || !period_end || !components) {
      return jsonResponse({ success: false, error: 'Missing required ITSS parameters' }, 400);
    }

    const authContext = await authorizeCompanyAccess(req, supabase, company_id);
    if (authContext instanceof Response) {
      return authContext;
    }

    console.log(`Generating ITSS package for company ${company_id}, period ${period_start} to ${period_end}`);

    // Get company info
    const { data: company, error: companyError } = await supabase
      .from('company')
      .select('*')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      throw new Error('Company not found');
    }

    const deliverables: any[] = [];
    const qtspEvidences: any[] = [];
    const preChecks: any[] = [];

    // ========== MODULE 1: DAILY RECORD ==========
    if (components.daily_record) {
      console.log('Generating daily record module...');

      // Get all time events for the period
      const { data: timeEvents, error: eventsError } = await supabase
        .from('time_events')
        .select(`
          *,
          employees!inner(
            id, employee_code, first_name, last_name, 
            email, department, company_id
          ),
          terminals(id, name, location)
        `)
        .eq('company_id', company_id)
        .gte('local_timestamp', period_start)
        .lte('local_timestamp', period_end + 'T23:59:59')
        .order('local_timestamp', { ascending: true });

      if (eventsError) throw eventsError;

      // Get corrected events
      const { data: correctedEvents } = await supabase
        .from('corrected_events')
        .select(`
          *,
          correction_requests(reason, status)
        `)
        .eq('company_id', company_id)
        .gte('local_timestamp', period_start)
        .lte('local_timestamp', period_end + 'T23:59:59');

      // Get daily roots for QTSP references
      const { data: dailyRoots } = await supabase
        .from('daily_roots')
        .select(`
          *,
          dt_evidences(tsp_token, tsp_timestamp, status)
        `)
        .eq('company_id', company_id)
        .gte('date', period_start)
        .lte('date', period_end);

      // Build daily records
      const dailyRecords: DailyRecord[] = [];
      const eventsByEmployeeDate = new Map<string, any[]>();

      // Group events by employee and date
      (timeEvents || []).forEach((event: any) => {
        const dateKey = event.local_timestamp.split('T')[0];
        const key = `${event.employee_id}_${dateKey}`;
        if (!eventsByEmployeeDate.has(key)) {
          eventsByEmployeeDate.set(key, []);
        }
        eventsByEmployeeDate.get(key)!.push(event);
      });

      // Add corrected events
      (correctedEvents || []).forEach((event: any) => {
        const dateKey = event.local_timestamp.split('T')[0];
        const key = `${event.employee_id}_${dateKey}`;
        if (!eventsByEmployeeDate.has(key)) {
          eventsByEmployeeDate.set(key, []);
        }
        eventsByEmployeeDate.get(key)!.push({
          ...event,
          is_correction: true
        });
      });

      // Process each employee-date combination
      for (const [key, events] of eventsByEmployeeDate) {
        const [employeeId, date] = key.split('_');
        const firstEvent = events[0];
        const employee = firstEvent.employees || firstEvent;

        // Sort events by time
        events.sort((a, b) => 
          new Date(a.local_timestamp || a.timestamp).getTime() - 
          new Date(b.local_timestamp || b.timestamp).getTime()
        );

        // Find entry and exit
        const entryEvent = events.find((e: any) => 
          e.event_type === 'clock_in' || e.event_type === 'pause_end'
        );
        const exitEvent = events.filter((e: any) => 
          e.event_type === 'clock_out' || e.event_type === 'pause_start'
        ).pop();

        // Calculate worked minutes
        let workedMinutes = 0;
        let lastEntry: Date | null = null;
        
        for (const event of events) {
          if (event.event_type === 'clock_in' || event.event_type === 'pause_end') {
            lastEntry = new Date(event.timestamp || event.local_timestamp);
          } else if (lastEntry && (event.event_type === 'clock_out' || event.event_type === 'pause_start')) {
            const exitTime = new Date(event.timestamp || event.local_timestamp);
            workedMinutes += (exitTime.getTime() - lastEntry.getTime()) / 60000;
            lastEntry = null;
          }
        }

        // Check for corrections
        const hasCorrection = events.some((e: any) => e.is_correction);
        const correctionReason = hasCorrection 
          ? events.find((e: any) => e.is_correction)?.correction_requests?.reason 
          : null;

        // Get QTSP reference
        const dailyRoot = (dailyRoots || []).find((r: any) => r.date === date);
        const qtspRef = dailyRoot?.dt_evidences?.[0]?.tsp_token;

        dailyRecords.push({
          company_id: company_id,
          company_name: company.name,
          center_id: null,
          center_name: null,
          employee_id: employeeId,
          employee_name: `${employee.first_name} ${employee.last_name}`,
          employee_code: employee.employee_code,
          nif: null,
          date: date,
          entry_time: entryEvent 
            ? new Date(entryEvent.timestamp || entryEvent.local_timestamp).toISOString()
            : null,
          exit_time: exitEvent 
            ? new Date(exitEvent.timestamp || exitEvent.local_timestamp).toISOString()
            : null,
          daily_worked_minutes: Math.round(workedMinutes),
          event_count: events.length,
          terminal_id: entryEvent?.terminal_id || null,
          terminal_name: entryEvent?.terminals?.name || null,
          auth_factor: entryEvent?.auth_factor || 'QR',
          origin: hasCorrection ? 'correction' : (entryEvent?.source || 'online'),
          correction_flag: hasCorrection,
          correction_reason: correctionReason,
          audit_ref: qtspRef || dailyRoot?.root_hash || null
        });
      }

      // Pre-checks
      const openEntries = dailyRecords.filter(r => r.entry_time && !r.exit_time);
      if (openEntries.length > 0) {
        preChecks.push({
          type: 'warning',
          message: `${openEntries.length} entradas sin salida en el periodo`,
          details: openEntries.slice(0, 10).map(r => ({
            employee: r.employee_name,
            date: r.date
          }))
        });
      }

      // Generate CSV content
      const csvHeaders = [
        'company_id', 'company_name', 'center_id', 'center_name',
        'employee_id', 'employee_name', 'employee_code', 'nif',
        'date', 'entry_time', 'exit_time', 'daily_worked_minutes',
        'event_count', 'terminal_id', 'terminal_name', 'auth_factor',
        'origin', 'correction_flag', 'correction_reason', 'audit_ref'
      ];

      const csvRows = dailyRecords.map(r => [
        r.company_id, r.company_name, r.center_id || '', r.center_name || '',
        r.employee_id, r.employee_name, r.employee_code, r.nif || '',
        r.date, r.entry_time || '', r.exit_time || '', r.daily_worked_minutes,
        r.event_count, r.terminal_id || '', r.terminal_name || '', r.auth_factor,
        r.origin, r.correction_flag, r.correction_reason || '', r.audit_ref || ''
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

      const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
      const csvHash = await computeHash(csvContent);

      deliverables.push({
        name: 'registro_diario.csv',
        type: 'csv',
        sha256: csvHash,
        rows: dailyRecords.length,
        content: csvContent
      });

      // Add QTSP evidences
      (dailyRoots || []).forEach((root: any) => {
        if (root.dt_evidences?.[0]?.tsp_token) {
          qtspEvidences.push({
            date: root.date,
            daily_root_hash: root.root_hash,
            tsp_token: root.dt_evidences[0].tsp_token,
            tsp_timestamp: root.dt_evidences[0].tsp_timestamp
          });
        }
      });
    }

    // ========== MODULE 2: LABOR CALENDAR ==========
    if (components.labor_calendar) {
      console.log('Generating labor calendar module...');

      const startYear = parseInt(period_start.split('-')[0]);
      const endYear = parseInt(period_end.split('-')[0]);

      const { data: calendars } = await supabase
        .from('labor_calendars')
        .select('*')
        .eq('company_id', company_id)
        .gte('year', startYear)
        .lte('year', endYear);

      const calendarContent = JSON.stringify(calendars || [], null, 2);
      const calendarHash = await computeHash(calendarContent);

      deliverables.push({
        name: 'calendario_laboral.json',
        type: 'json',
        sha256: calendarHash,
        content: calendarContent
      });
    }

    // ========== MODULE 3: POLICIES ==========
    if (components.policies) {
      console.log('Generating policies module...');

      const { data: documents } = await supabase
        .from('legal_documents')
        .select('*')
        .eq('company_id', company_id)
        .eq('is_published', true)
        .in('code', ['DOC-01', 'DOC-06', 'DOC-07', 'DOC-09']);

      (documents || []).forEach((doc: any) => {
        deliverables.push({
          name: `${doc.code}_${doc.name.replace(/\s+/g, '_')}.md`,
          type: 'markdown',
          sha256: '', // Will be calculated
          content: doc.content_markdown
        });
      });
    }

    // ========== MODULE 4: CONTRACT SUMMARY ==========
    if (components.contract_summary) {
      console.log('Generating contract summary module...');

      const { data: employees } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', company_id)
        .eq('status', 'active');

      const employeeSummary = (employees || []).map((e: any) => ({
        employee_code: e.employee_code,
        name: `${e.first_name} ${e.last_name}`,
        department: e.department,
        position: e.position,
        hire_date: e.hire_date
      }));

      const summaryContent = JSON.stringify(employeeSummary, null, 2);
      const summaryHash = await computeHash(summaryContent);

      deliverables.push({
        name: 'sumario_empleados.json',
        type: 'json',
        sha256: summaryHash,
        rows: employeeSummary.length,
        content: summaryContent
      });
    }

    // ========== MODULE 5: EVIDENCES ==========
    const evidencesContent = JSON.stringify({
      qtsp_provider: 'EADTrust',
      evidences: qtspEvidences,
      total_days_with_evidence: qtspEvidences.length
    }, null, 2);
    const evidencesHash = await computeHash(evidencesContent);

    deliverables.push({
      name: 'referencias_qtsp.json',
      type: 'json',
      sha256: evidencesHash,
      content: evidencesContent
    });

    // ========== GENERATE MANIFEST ==========
    const manifest = {
      version: '1.0',
      company: {
        id: company_id,
        name: company.name,
        cif: company.cif
      },
      centers: centers || [],
      period: {
        start: period_start,
        end: period_end
      },
      itss_reference: expedient_number ? {
        expedient_id: expedient_number,
        request_date: request_date,
        contact_person: contact_person
      } : null,
      deliverables: deliverables.map(d => ({
        name: d.name,
        type: d.type,
        sha256: d.sha256,
        rows: d.rows
      })),
      qtsp_evidences: qtspEvidences,
      pre_checks: preChecks,
      generated_at: new Date().toISOString(),
      generated_by: authContext.userId,
      integrity: {
        algorithm: 'SHA-256',
        package_hash: '' // Calculated below
      }
    };

    // Calculate package hash
    const packageContent = deliverables.map(d => d.sha256).join('');
    manifest.integrity.package_hash = await computeHash(packageContent);

    if (dry_run) {
      return new Response(JSON.stringify({
        success: true,
      dry_run: true,
      manifest,
      pre_checks: preChecks,
        deliverables_count: deliverables.length,
        qtsp_evidences_count: qtspEvidences.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Save package record
    const { data: packageRecord, error: packageError } = await supabase
      .from('itss_packages')
      .insert({
        company_id,
        expedient_number,
        request_date,
        period_start,
        period_end,
        centers: centers || [],
        components,
        manifest,
        package_hash: manifest.integrity.package_hash,
        status: 'generated',
        generated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (packageError) throw packageError;

    // Log to audit
    await supabase.from('audit_log').insert({
      actor_id: authContext.userId,
      actor_type: 'user',
      action: 'generate_itss_package',
      entity_type: 'itss_package',
      entity_id: packageRecord.id,
      company_id,
      new_values: {
        period: `${period_start} - ${period_end}`,
        expedient: expedient_number,
        deliverables_count: deliverables.length
      }
    });

    return new Response(JSON.stringify({
      success: true,
      package_id: packageRecord.id,
      manifest,
      pre_checks: preChecks,
      deliverables: deliverables.map(d => ({
        name: d.name,
        type: d.type,
        sha256: d.sha256,
        rows: d.rows,
        content: d.content
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Error generating ITSS package:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      success: false,
      error: message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
