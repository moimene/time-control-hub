import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  jsonResponse,
  requireAnyRole,
  requireCallerContext,
  requireCompanyAccess,
} from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CoverageCheckRequest {
  company_id: string;
  center_id?: string;
  department?: string;
  job_profile_id?: string;
  start_date: string;
  end_date: string;
  employee_id: string;
}

interface CoverageCheckResponse {
  team_available_pct: number;
  conflicts: { date: string; type: string; details: string }[];
  can_approve: boolean;
  rule_id: string | null;
  blackout_dates: string[];
  total_team: number;
  available_team: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CoverageCheckRequest = await req.json();
    const { company_id, center_id, department, job_profile_id, start_date, end_date, employee_id } = body;

    if (!company_id || !start_date || !end_date || !employee_id) {
      return jsonResponse({ error: 'Missing required coverage check parameters' }, 400, corsHeaders);
    }

    const caller = await requireCallerContext({
      req,
      supabaseAdmin: supabase,
      corsHeaders,
      allowServiceRole: true,
    });
    if (caller instanceof Response) return caller;

    if (caller.kind === 'user') {
      const roleError = requireAnyRole({
        ctx: caller,
        allowed: ['super_admin', 'admin', 'responsible', 'employee'],
        corsHeaders,
      });
      if (roleError) return roleError;

      const companyAccess = await requireCompanyAccess({
        supabaseAdmin: supabase,
        ctx: caller,
        companyId: company_id,
        corsHeaders,
        allowEmployee: true,
      });
      if (companyAccess instanceof Response) return companyAccess;

      // Prevent employees from probing coverage for other employees.
      if (!caller.isAdminLike && companyAccess.employeeId && employee_id !== companyAccess.employeeId) {
        return jsonResponse({ error: 'Employees can only request coverage checks for themselves' }, 403, corsHeaders);
      }
    }

    console.log(`[coverage-check] Checking coverage for employee ${employee_id} from ${start_date} to ${end_date}`);

    // 1. Obtener regla de cobertura aplicable (más específica primero)
    let ruleQuery = supabase
      .from('coverage_rules')
      .select('*')
      .eq('company_id', company_id)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (center_id) {
      ruleQuery = ruleQuery.or(`center_id.eq.${center_id},center_id.is.null`);
    }
    if (department) {
      ruleQuery = ruleQuery.or(`department.eq.${department},department.is.null`);
    }

    const { data: rules, error: rulesError } = await ruleQuery.limit(1);
    
    if (rulesError) {
      console.error('[coverage-check] Error fetching rules:', rulesError);
      throw rulesError;
    }

    const rule = rules?.[0] || null;
    const minTeamPct = rule?.min_team_available_pct ?? 50;
    const maxSimultaneous = rule?.max_simultaneous_absences ?? null;
    const blackoutRanges = (rule?.blackout_ranges as any[]) || [];

    console.log(`[coverage-check] Using rule: ${rule?.id || 'default'}, min_pct: ${minTeamPct}, max_simultaneous: ${maxSimultaneous}`);

    // 2. Obtener empleados activos en el ámbito
    let employeesQuery = supabase
      .from('employees')
      .select('id, department, position')
      .eq('company_id', company_id)
      .eq('status', 'active');

    if (department) {
      employeesQuery = employeesQuery.eq('department', department);
    }

    const { data: employees, error: employeesError } = await employeesQuery;
    
    if (employeesError) {
      console.error('[coverage-check] Error fetching employees:', employeesError);
      throw employeesError;
    }

    const totalTeam = employees?.length || 0;
    console.log(`[coverage-check] Total team members: ${totalTeam}`);

    // 3. Obtener ausencias aprobadas en la ventana de fechas (excluyendo al solicitante)
    const { data: approvedAbsences, error: absencesError } = await supabase
      .from('absence_requests')
      .select('id, employee_id, start_date, end_date, absence_type_id')
      .eq('company_id', company_id)
      .eq('status', 'approved')
      .neq('employee_id', employee_id)
      .lte('start_date', end_date)
      .gte('end_date', start_date);

    if (absencesError) {
      console.error('[coverage-check] Error fetching absences:', absencesError);
      throw absencesError;
    }

    console.log(`[coverage-check] Found ${approvedAbsences?.length || 0} overlapping approved absences`);

    // 4. Calcular conflictos por día
    const conflicts: { date: string; type: string; details: string }[] = [];
    const blackoutDates: string[] = [];
    
    // Generar array de fechas en el rango
    const startD = new Date(start_date);
    const endD = new Date(end_date);
    const dateRange: string[] = [];
    
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      dateRange.push(d.toISOString().split('T')[0]);
    }

    // Verificar blackout ranges
    for (const range of blackoutRanges) {
      const rangeStart = new Date(range.start);
      const rangeEnd = new Date(range.end);
      
      for (const dateStr of dateRange) {
        const checkDate = new Date(dateStr);
        if (checkDate >= rangeStart && checkDate <= rangeEnd) {
          blackoutDates.push(dateStr);
          conflicts.push({
            date: dateStr,
            type: 'blackout',
            details: range.reason || 'Período bloqueado por la empresa'
          });
        }
      }
    }

    // Calcular ausentes por día y encontrar el peor día
    let maxAbsent = 0;
    let worstDate = '';
    
    for (const dateStr of dateRange) {
      const absentOnDay = approvedAbsences?.filter(abs => {
        const absStart = new Date(abs.start_date);
        const absEnd = new Date(abs.end_date);
        const checkDate = new Date(dateStr);
        return checkDate >= absStart && checkDate <= absEnd;
      }).length || 0;

      // +1 porque estamos verificando si añadir esta solicitud
      const totalAbsentWithNew = absentOnDay + 1;
      
      if (totalAbsentWithNew > maxAbsent) {
        maxAbsent = totalAbsentWithNew;
        worstDate = dateStr;
      }

      // Verificar máximo simultáneo
      if (maxSimultaneous && totalAbsentWithNew > maxSimultaneous) {
        conflicts.push({
          date: dateStr,
          type: 'max_simultaneous',
          details: `Máximo de ${maxSimultaneous} ausencias simultáneas superado (${totalAbsentWithNew})`
        });
      }
    }

    // 5. Calcular porcentaje de equipo disponible (en el peor día)
    const availableTeam = Math.max(0, totalTeam - maxAbsent);
    const teamAvailablePct = totalTeam > 0 ? (availableTeam / totalTeam) * 100 : 100;

    console.log(`[coverage-check] Worst day: ${worstDate}, absent: ${maxAbsent}, available: ${availableTeam}/${totalTeam} (${teamAvailablePct.toFixed(1)}%)`);

    // Añadir conflicto si está por debajo del mínimo
    if (teamAvailablePct < minTeamPct && worstDate) {
      conflicts.push({
        date: worstDate,
        type: 'coverage',
        details: `Cobertura mínima (${minTeamPct}%) no alcanzada: ${teamAvailablePct.toFixed(1)}%`
      });
    }

    // 6. Determinar si se puede aprobar
    const hasBlackoutConflict = blackoutDates.length > 0;
    const hasCoverageConflict = teamAvailablePct < minTeamPct;
    const hasSimultaneousConflict = conflicts.some(c => c.type === 'max_simultaneous');
    
    const canApprove = !hasBlackoutConflict && !hasCoverageConflict && !hasSimultaneousConflict;

    const response: CoverageCheckResponse = {
      team_available_pct: Math.round(teamAvailablePct * 10) / 10,
      conflicts,
      can_approve: canApprove,
      rule_id: rule?.id || null,
      blackout_dates: [...new Set(blackoutDates)],
      total_team: totalTeam,
      available_team: availableTeam
    };

    console.log(`[coverage-check] Result: can_approve=${canApprove}, conflicts=${conflicts.length}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[coverage-check] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
