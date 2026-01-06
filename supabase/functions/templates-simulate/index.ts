import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TemplatePayload {
  limits?: {
    max_daily_hours?: number;
    min_daily_rest?: number;
    min_weekly_rest?: number;
    max_overtime_yearly?: number;
  };
  breaks?: {
    required_after_hours?: number;
    min_break_minutes?: number;
  };
  overtime?: {
    thresholds?: Array<{
      percent: number;
      severity: string;
    }>;
  };
}

interface SimulationViolation {
  rule_code: string;
  employee_id: string;
  employee_name: string;
  violation_date: string;
  severity: string;
  details: string;
}

interface TimeEvent {
  id: string;
  employee_id: string;
  event_type: string;
  timestamp: string;
  local_timestamp: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { rule_version_id, company_id, period_days = 30 } = await req.json();

    if (!rule_version_id || !company_id) {
      return new Response(JSON.stringify({ error: "rule_version_id and company_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the template payload
    const { data: version, error: versionError } = await supabase
      .from('rule_versions')
      .select('payload_json')
      .eq('id', rule_version_id)
      .single();

    if (versionError || !version) {
      return new Response(JSON.stringify({ error: "Version not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = version.payload_json as TemplatePayload;
    const limits = payload.limits || {};
    const overtimeThresholds = payload.overtime?.thresholds || [];

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period_days);

    // Fetch employees
    const { data: employees } = await supabase
      .from('employees')
      .select('id, first_name, last_name')
      .eq('company_id', company_id)
      .eq('status', 'active');

    if (!employees || employees.length === 0) {
      return new Response(JSON.stringify({
        violations: [],
        summary: { total: 0, by_rule: {}, by_severity: {} },
        period: { start: startDate.toISOString(), end: endDate.toISOString(), days: period_days }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const employeeMap = new Map<string, Employee>();
    employees.forEach(e => employeeMap.set(e.id, e));

    // Fetch time events for the period
    const { data: events } = await supabase
      .from('time_events')
      .select('id, employee_id, event_type, timestamp, local_timestamp')
      .eq('company_id', company_id)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: true });

    const violations: SimulationViolation[] = [];
    const maxDailyHours = limits.max_daily_hours || 9;
    const minDailyRest = limits.min_daily_rest || 12;
    const minWeeklyRest = limits.min_weekly_rest || 36;
    const maxOvertimeYearly = limits.max_overtime_yearly || 80;

    // Group events by employee and date
    const eventsByEmployee = new Map<string, TimeEvent[]>();
    (events || []).forEach(event => {
      const list = eventsByEmployee.get(event.employee_id) || [];
      list.push(event);
      eventsByEmployee.set(event.employee_id, list);
    });

    // Calculate yearly overtime (simplified - from Jan 1)
    const yearStart = new Date(endDate.getFullYear(), 0, 1);
    const { data: yearlyEvents } = await supabase
      .from('time_events')
      .select('employee_id, event_type, timestamp')
      .eq('company_id', company_id)
      .gte('timestamp', yearStart.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: true });

    const yearlyHoursByEmployee = new Map<string, number>();
    const yearlyEventsByEmployee = new Map<string, TimeEvent[]>();
    (yearlyEvents || []).forEach(event => {
      const list = yearlyEventsByEmployee.get(event.employee_id) || [];
      list.push(event as TimeEvent);
      yearlyEventsByEmployee.set(event.employee_id, list);
    });

    // Calculate total worked hours per employee this year
    yearlyEventsByEmployee.forEach((empEvents, empId) => {
      let totalHours = 0;
      let lastEntry: Date | null = null;

      empEvents.forEach(event => {
        const eventTime = new Date(event.timestamp);
        if (event.event_type === 'entry') {
          lastEntry = eventTime;
        } else if (event.event_type === 'exit' && lastEntry) {
          const hours = (eventTime.getTime() - lastEntry.getTime()) / (1000 * 60 * 60);
          totalHours += hours;
          lastEntry = null;
        }
      });

      yearlyHoursByEmployee.set(empId, totalHours);
    });

    // Simulate violations for each employee
    for (const [employeeId, empEvents] of eventsByEmployee) {
      const employee = employeeMap.get(employeeId);
      if (!employee) continue;

      const employeeName = `${employee.first_name} ${employee.last_name}`;

      // Group by date
      const eventsByDate = new Map<string, TimeEvent[]>();
      empEvents.forEach(event => {
        const date = event.local_timestamp.split('T')[0];
        const list = eventsByDate.get(date) || [];
        list.push(event);
        eventsByDate.set(date, list);
      });

      let previousExitMs: number | null = null;

      for (const [date, dayEvents] of eventsByDate) {
        let dayHours = 0;
        let lastEntryMs: number | null = null;
        let firstEntryMs: number | null = null;
        let lastExitMs: number | null = null;

        dayEvents.forEach(event => {
          const eventMs = new Date(event.timestamp).getTime();
          if (event.event_type === 'entry') {
            if (firstEntryMs === null) firstEntryMs = eventMs;
            lastEntryMs = eventMs;
          } else if (event.event_type === 'exit') {
            lastExitMs = eventMs;
            if (lastEntryMs !== null) {
              const hours = (eventMs - lastEntryMs) / (1000 * 60 * 60);
              dayHours += hours;
              lastEntryMs = null;
            }
          }
        });

        // Check MAX_DAILY_HOURS
        if (dayHours > maxDailyHours) {
          violations.push({
            rule_code: 'MAX_DAILY_HOURS',
            employee_id: employeeId,
            employee_name: employeeName,
            violation_date: date,
            severity: dayHours > 10 ? 'critical' : 'warn',
            details: `${dayHours.toFixed(1)}h trabajadas (máx: ${maxDailyHours}h)`
          });
        }

        // Check MIN_DAILY_REST
        if (previousExitMs !== null && firstEntryMs !== null) {
          const restHours = (firstEntryMs - previousExitMs) / (1000 * 60 * 60);
          if (restHours < minDailyRest && restHours > 0) {
            violations.push({
              rule_code: 'MIN_DAILY_REST',
              employee_id: employeeId,
              employee_name: employeeName,
              violation_date: date,
              severity: restHours < 10 ? 'critical' : 'warn',
              details: `${restHours.toFixed(1)}h de descanso (mín: ${minDailyRest}h)`
            });
          }
        }

        if (lastExitMs !== null) {
          previousExitMs = lastExitMs;
        }
      }

      // Check overtime thresholds
      const yearlyHours = yearlyHoursByEmployee.get(employeeId) || 0;
      const standardYearlyHours = 1800; // ~40h/week * 45 weeks
      const overtimeHours = Math.max(0, yearlyHours - standardYearlyHours);
      const overtimePercent = (overtimeHours / maxOvertimeYearly) * 100;

      for (const threshold of overtimeThresholds) {
        if (overtimePercent >= threshold.percent) {
          violations.push({
            rule_code: `OVERTIME_YTD_${threshold.percent}`,
            employee_id: employeeId,
            employee_name: employeeName,
            violation_date: endDate.toISOString().split('T')[0],
            severity: threshold.severity,
            details: `${overtimeHours.toFixed(0)}h extra (${overtimePercent.toFixed(0)}% del límite)`
          });
        }
      }
    }

    // Build summary
    const byRule: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    violations.forEach(v => {
      byRule[v.rule_code] = (byRule[v.rule_code] || 0) + 1;
      bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1;
    });

    return new Response(
      JSON.stringify({
        violations,
        summary: {
          total: violations.length,
          by_rule: byRule,
          by_severity: bySeverity,
          employees_affected: new Set(violations.map(v => v.employee_id)).size,
        },
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          days: period_days
        },
        template_limits: {
          max_daily_hours: maxDailyHours,
          min_daily_rest: minDailyRest,
          min_weekly_rest: minWeeklyRest,
          max_overtime_yearly: maxOvertimeYearly,
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const error = err as Error;
    console.error("Error simulating template:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
