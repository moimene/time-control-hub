import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rule codes and their fallback configurations
const FALLBACK_RULES = {
  MAX_DAILY_HOURS: { code: 'MAX_DAILY_HOURS', name: 'Jornada máxima diaria', limit: 9, severity: 'critical' as const },
  MIN_DAILY_REST: { code: 'MIN_DAILY_REST', name: 'Descanso diario mínimo', limit: 12, severity: 'critical' as const },
  MIN_WEEKLY_REST: { code: 'MIN_WEEKLY_REST', name: 'Descanso semanal mínimo', limit: 36, severity: 'critical' as const },
  BREAK_REQUIRED: { code: 'BREAK_REQUIRED', name: 'Pausa intrajornada requerida', limit: 6, severity: 'warn' as const },
  OVERTIME_YTD_75: { code: 'OVERTIME_YTD_75', name: 'Horas extra 75% límite', limit: 60, severity: 'warn' as const },
  OVERTIME_YTD_90: { code: 'OVERTIME_YTD_90', name: 'Horas extra 90% límite', limit: 72, severity: 'critical' as const },
  OVERTIME_YTD_CAP: { code: 'OVERTIME_YTD_CAP', name: 'Horas extra límite legal', limit: 80, severity: 'critical' as const },
}

/**
 * Fetches the applicable rules for an employee from the database.
 * Follows precedence: Employee Override -> Department -> Center -> Company -> Global Template
 */
async function getEffectiveRules(supabase: any, companyId: string, employeeId: string) {
  // 1. Try to find an active rule assignment for the employee
  const { data: assignments, error } = await supabase
    .from('rule_assignments')
    .select(`
      rule_version_id,
      priority,
      rule_versions (
        payload_json
      )
    `)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .or(`employee_id.eq.${employeeId},employee_id.is.null`)
    .order('priority', { ascending: false });

  if (error || !assignments?.length) {
    return FALLBACK_RULES;
  }

  // Merge rules (highest priority wins)
  let mergedRules = { ...FALLBACK_RULES };
  for (const assignment of assignments) {
    const payload = assignment.rule_versions?.payload_json;
    if (payload && typeof payload === 'object') {
      mergedRules = { ...mergedRules, ...payload };
    }
  }

  return mergedRules;
}

interface TimeEvent {
  id: string
  employee_id: string
  event_type: 'entry' | 'exit'
  timestamp: string
  local_timestamp: string
}

interface WorkSession {
  entry: TimeEvent
  exit: TimeEvent | null
  hours: number
}

interface Violation {
  company_id: string
  employee_id: string
  rule_code: string
  severity: 'info' | 'warn' | 'critical'
  evidence_json: Record<string, unknown>
  violation_date: string
  status: 'open'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { company_id, date, employee_id } = await req.json()

    if (!company_id) {
      throw new Error('company_id is required')
    }

    const targetDate = date || new Date().toISOString().split('T')[0]
    console.log(`Evaluating compliance for company ${company_id} on ${targetDate}`)

    // Get employees to evaluate
    let employeeQuery = supabase
      .from('employees')
      .select('id, first_name, last_name, employee_code')
      .eq('company_id', company_id)
      .eq('status', 'active')

    if (employee_id) {
      employeeQuery = employeeQuery.eq('id', employee_id)
    }

    const { data: employees, error: empError } = await employeeQuery
    if (empError) throw empError

    console.log(`Found ${employees?.length || 0} employees to evaluate`)

    const violations: Violation[] = []
    const startOfYear = `${targetDate.substring(0, 4)}-01-01`

    for (const employee of employees || []) {
      // 0. Get dynamic rules for this employee
      const RULES = await getEffectiveRules(supabase, company_id, employee.id);

      // 1. Get time events for the target date
      const { data: dayEvents, error: dayError } = await supabase
        .from('time_events')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('local_timestamp', `${targetDate}T00:00:00`)
        .lt('local_timestamp', `${targetDate}T23:59:59`)
        .order('local_timestamp', { ascending: true })

      if (dayError) {
        console.error(`Error fetching events for employee ${employee.id}:`, dayError)
        continue
      }

      // Calculate work sessions for the day
      const sessions = calculateWorkSessions(dayEvents || [])
      const totalHours = sessions.reduce((sum, s) => sum + s.hours, 0)

      // Rule 1: MAX_DAILY_HOURS
      if (totalHours > RULES.MAX_DAILY_HOURS.limit) {
        violations.push({
          company_id,
          employee_id: employee.id,
          rule_code: RULES.MAX_DAILY_HOURS.code,
          severity: RULES.MAX_DAILY_HOURS.severity,
          violation_date: targetDate,
          status: 'open',
          evidence_json: {
            rule_name: RULES.MAX_DAILY_HOURS.name,
            limit: RULES.MAX_DAILY_HOURS.limit,
            actual: Math.round(totalHours * 100) / 100,
            sessions: sessions.map(s => ({
              entry: s.entry.local_timestamp,
              exit: s.exit?.local_timestamp,
              hours: s.hours
            }))
          }
        })
      }

      // Rule 4: BREAK_REQUIRED (if worked > 6h without break)
      for (const session of sessions) {
        if (session.hours > RULES.BREAK_REQUIRED.limit) {
          violations.push({
            company_id,
            employee_id: employee.id,
            rule_code: RULES.BREAK_REQUIRED.code,
            severity: RULES.BREAK_REQUIRED.severity,
            violation_date: targetDate,
            status: 'open',
            evidence_json: {
              rule_name: RULES.BREAK_REQUIRED.name,
              session_hours: Math.round(session.hours * 100) / 100,
              limit_hours: RULES.BREAK_REQUIRED.limit,
              entry: session.entry.local_timestamp,
              exit: session.exit?.local_timestamp
            }
          })
        }
      }

      // Rule 2: MIN_DAILY_REST (check previous day's last exit to today's first entry)
      const prevDate = new Date(targetDate)
      prevDate.setDate(prevDate.getDate() - 1)
      const prevDateStr = prevDate.toISOString().split('T')[0]

      const { data: prevDayEvents } = await supabase
        .from('time_events')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('local_timestamp', `${prevDateStr}T00:00:00`)
        .lt('local_timestamp', `${prevDateStr}T23:59:59`)
        .eq('event_type', 'exit')
        .order('local_timestamp', { ascending: false })
        .limit(1)

      if (prevDayEvents?.length && dayEvents?.length) {
        const lastExit = new Date(prevDayEvents[0].timestamp)
        const firstEntry = dayEvents.find(e => e.event_type === 'entry')
        if (firstEntry) {
          const restHours = (new Date(firstEntry.timestamp).getTime() - lastExit.getTime()) / (1000 * 60 * 60)
          if (restHours < RULES.MIN_DAILY_REST.limit) {
            violations.push({
              company_id,
              employee_id: employee.id,
              rule_code: RULES.MIN_DAILY_REST.code,
              severity: RULES.MIN_DAILY_REST.severity,
              violation_date: targetDate,
              status: 'open',
              evidence_json: {
                rule_name: RULES.MIN_DAILY_REST.name,
                required_hours: RULES.MIN_DAILY_REST.limit,
                actual_hours: Math.round(restHours * 100) / 100,
                previous_exit: prevDayEvents[0].local_timestamp,
                current_entry: firstEntry.local_timestamp
              }
            })
          }
        }
      }

      // Calculate YTD overtime for this employee
      const { data: ytdEvents } = await supabase
        .from('time_events')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('local_timestamp', startOfYear)
        .lte('local_timestamp', `${targetDate}T23:59:59`)
        .order('local_timestamp', { ascending: true })

      const ytdSessions = calculateWorkSessions(ytdEvents || [])
      const ytdTotalHours = ytdSessions.reduce((sum, s) => sum + s.hours, 0)

      // Assuming 8h/day standard, calculate approximate working days
      const startDate = new Date(startOfYear)
      const endDate = new Date(targetDate)
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const workingDays = Math.floor(daysDiff * 5 / 7) // Approximate working days
      const standardHours = workingDays * 8
      const overtimeYTD = Math.max(0, ytdTotalHours - standardHours)

      // Rule 5: OVERTIME_YTD_75
      if (overtimeYTD > RULES.OVERTIME_YTD_75.limit && overtimeYTD <= RULES.OVERTIME_YTD_90.limit) {
        violations.push({
          company_id,
          employee_id: employee.id,
          rule_code: RULES.OVERTIME_YTD_75.code,
          severity: RULES.OVERTIME_YTD_75.severity,
          violation_date: targetDate,
          status: 'open',
          evidence_json: {
            rule_name: RULES.OVERTIME_YTD_75.name,
            threshold_hours: RULES.OVERTIME_YTD_75.limit,
            overtime_ytd: Math.round(overtimeYTD * 100) / 100,
            percentage: Math.round((overtimeYTD / RULES.OVERTIME_YTD_CAP.limit) * 100)
          }
        })
      }

      // Rule 6: OVERTIME_YTD_90
      if (overtimeYTD > RULES.OVERTIME_YTD_90.limit && overtimeYTD <= RULES.OVERTIME_YTD_CAP.limit) {
        violations.push({
          company_id,
          employee_id: employee.id,
          rule_code: RULES.OVERTIME_YTD_90.code,
          severity: RULES.OVERTIME_YTD_90.severity,
          violation_date: targetDate,
          status: 'open',
          evidence_json: {
            rule_name: RULES.OVERTIME_YTD_90.name,
            threshold_hours: RULES.OVERTIME_YTD_90.limit,
            overtime_ytd: Math.round(overtimeYTD * 100) / 100,
            percentage: Math.round((overtimeYTD / RULES.OVERTIME_YTD_CAP.limit) * 100)
          }
        })
      }

      // Rule 7: OVERTIME_YTD_CAP
      if (overtimeYTD > RULES.OVERTIME_YTD_CAP.limit) {
        violations.push({
          company_id,
          employee_id: employee.id,
          rule_code: RULES.OVERTIME_YTD_CAP.code,
          severity: RULES.OVERTIME_YTD_CAP.severity,
          violation_date: targetDate,
          status: 'open',
          evidence_json: {
            rule_name: RULES.OVERTIME_YTD_CAP.name,
            limit_hours: RULES.OVERTIME_YTD_CAP.limit,
            overtime_ytd: Math.round(overtimeYTD * 100) / 100,
            excess_hours: Math.round((overtimeYTD - RULES.OVERTIME_YTD_CAP.limit) * 100) / 100
          }
        })
      }
    }

    // Check for weekly rest violations (run on Sundays or when explicitly requested)
    const dayOfWeek = new Date(targetDate).getDay()
    if (dayOfWeek === 0) { // Sunday
      for (const employee of employees || []) {
        const weekViolation = await checkWeeklyRest(supabase as any, company_id, employee.id, targetDate)
        if (weekViolation) {
          violations.push(weekViolation)
        }
      }
    }

    console.log(`Found ${violations.length} violations`)

    // Insert violations (upsert to avoid duplicates)
    if (violations.length > 0) {
      for (const violation of violations) {
        // Check if violation already exists for this employee/rule/date
        const { data: existing } = await supabase
          .from('compliance_violations')
          .select('id')
          .eq('employee_id', violation.employee_id)
          .eq('rule_code', violation.rule_code)
          .eq('violation_date', violation.violation_date)
          .single()

        if (!existing) {
          const { error: insertError } = await supabase
            .from('compliance_violations')
            .insert(violation)

          if (insertError) {
            console.error(`Error inserting violation:`, insertError)
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: targetDate,
        employees_evaluated: employees?.length || 0,
        violations_found: violations.length,
        violations: violations
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Compliance evaluation error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function calculateWorkSessions(events: TimeEvent[]): WorkSession[] {
  const sessions: WorkSession[] = []
  let currentEntry: TimeEvent | null = null

  for (const event of events) {
    if (event.event_type === 'entry') {
      currentEntry = event
    } else if (event.event_type === 'exit' && currentEntry) {
      const entryTime = new Date(currentEntry.timestamp).getTime()
      const exitTime = new Date(event.timestamp).getTime()
      const hours = (exitTime - entryTime) / (1000 * 60 * 60)

      sessions.push({
        entry: currentEntry,
        exit: event,
        hours: Math.max(0, hours)
      })
      currentEntry = null
    }
  }

  // Handle open session (entry without exit)
  if (currentEntry) {
    sessions.push({
      entry: currentEntry,
      exit: null,
      hours: 0
    })
  }

  return sessions
}

async function checkWeeklyRest(
  supabase: any,
  company_id: string,
  employee_id: string,
  targetDate: string
): Promise<Violation | null> {
  // Get dynamic rules for this employee
  const RULES = await getEffectiveRules(supabase, company_id, employee_id);

  // Get events for the past 7 days
  const weekStart = new Date(targetDate)
  weekStart.setDate(weekStart.getDate() - 6)
  const weekStartStr = weekStart.toISOString().split('T')[0]

  const { data: weekEvents } = await supabase
    .from('time_events')
    .select('*')
    .eq('employee_id', employee_id)
    .gte('local_timestamp', `${weekStartStr}T00:00:00`)
    .lte('local_timestamp', `${targetDate}T23:59:59`)
    .order('local_timestamp', { ascending: true })

  if (!weekEvents?.length) return null

  // Find the longest consecutive rest period
  const sessions = calculateWorkSessions(weekEvents)
  if (sessions.length < 2) return null

  let maxRestHours = 0
  for (let i = 1; i < sessions.length; i++) {
    if (sessions[i - 1].exit && sessions[i].entry) {
      const restStart = new Date(sessions[i - 1].exit!.timestamp).getTime()
      const restEnd = new Date(sessions[i].entry.timestamp).getTime()
      const restHours = (restEnd - restStart) / (1000 * 60 * 60)
      maxRestHours = Math.max(maxRestHours, restHours)
    }
  }

  if (maxRestHours < RULES.MIN_WEEKLY_REST.limit) {
    return {
      company_id,
      employee_id,
      rule_code: RULES.MIN_WEEKLY_REST.code,
      severity: RULES.MIN_WEEKLY_REST.severity,
      violation_date: targetDate,
      status: 'open',
      evidence_json: {
        rule_name: RULES.MIN_WEEKLY_REST.name,
        required_hours: RULES.MIN_WEEKLY_REST.limit,
        max_rest_found: Math.round(maxRestHours * 100) / 100,
        week_start: weekStartStr,
        week_end: targetDate
      }
    }
  }

  return null
}
