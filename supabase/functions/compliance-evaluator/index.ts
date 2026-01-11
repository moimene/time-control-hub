import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Default fallback rules (used only if no rule_sets found)
const DEFAULT_RULES = {
  MAX_DAILY_HOURS: 9,
  MAX_WEEKLY_HOURS: 40,
  MIN_DAILY_REST: 12,
  MIN_WEEKLY_REST: 36,
  BREAK_AFTER_HOURS: 6,
  BREAK_DURATION_MIN: 15,
  OVERTIME_MAX_YEAR: 80,
}

interface RuleSet {
  id: string
  name: string
  origin: 'law' | 'collective_agreement' | 'contract'
  status: string
  rules: Record<string, number | boolean>
  effective_from: string
  effective_to: string | null
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
  rule_version_id?: string
  severity: 'info' | 'warn' | 'critical'
  evidence_json: Record<string, unknown>
  violation_date: string
  status: 'open'
}

/**
 * Get effective rules for a company following precedence:
 * Law (base) -> Collective Agreement (overrides) -> Contract (highest priority)
 */
async function getEffectiveRules(
  supabase: any,
  companyId: string,
  date: string
): Promise<{ rules: Record<string, number | boolean>; source: string; ruleSetId: string | null }> {
  const { data: ruleSets, error } = await supabase
    .from('rule_sets')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .lte('effective_from', date)
    .or(`effective_to.is.null,effective_to.gte.${date}`)
    .order('origin', { ascending: true })

  if (error) {
    console.error('Error fetching rule_sets:', error)
    return { rules: DEFAULT_RULES, source: 'default_fallback', ruleSetId: null }
  }

  if (!ruleSets?.length) {
    console.log(`No rule_sets found for company ${companyId}, using defaults`)
    return { rules: DEFAULT_RULES, source: 'default_fallback', ruleSetId: null }
  }

  // Apply precedence: start with law, then overlay with higher priority origins
  const precedenceOrder = ['law', 'collective_agreement', 'contract']
  let mergedRules: Record<string, number | boolean> = { ...DEFAULT_RULES }
  let source = 'default_fallback'
  let ruleSetId: string | null = null

  for (const origin of precedenceOrder) {
    const ruleSet = (ruleSets as RuleSet[]).find((r: RuleSet) => r.origin === origin)
    if (ruleSet && ruleSet.rules) {
      mergedRules = { ...mergedRules, ...ruleSet.rules }
      source = `${origin}:${ruleSet.name}`
      ruleSetId = ruleSet.id
      console.log(`Applied ${origin} rules from "${ruleSet.name}"`)
    }
  }

  return { rules: mergedRules, source, ruleSetId }
}

function getSeverity(ruleCode: string): 'info' | 'warn' | 'critical' {
  const criticalRules = ['MAX_DAILY_HOURS', 'MIN_DAILY_REST', 'MIN_WEEKLY_REST', 'OVERTIME_YTD_CAP']
  const warnRules = ['BREAK_AFTER_HOURS', 'OVERTIME_YTD_75', 'OVERTIME_YTD_90']
  
  if (criticalRules.includes(ruleCode)) return 'critical'
  if (warnRules.includes(ruleCode)) return 'warn'
  return 'info'
}

Deno.serve(async (req) => {
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

    // Get effective rules for this company (with precedence)
    const { rules, source, ruleSetId } = await getEffectiveRules(supabase, company_id, targetDate)
    console.log(`Using rules from: ${source}`, rules)

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

    // Extract rule values with fallbacks
    const MAX_DAILY_HOURS = (rules.MAX_DAILY_HOURS as number) || DEFAULT_RULES.MAX_DAILY_HOURS
    const MIN_DAILY_REST = (rules.MIN_DAILY_REST as number) || DEFAULT_RULES.MIN_DAILY_REST
    const MIN_WEEKLY_REST = (rules.MIN_WEEKLY_REST as number) || DEFAULT_RULES.MIN_WEEKLY_REST
    const BREAK_AFTER_HOURS = (rules.BREAK_AFTER_HOURS as number) || DEFAULT_RULES.BREAK_AFTER_HOURS
    const OVERTIME_MAX_YEAR = (rules.OVERTIME_MAX_YEAR as number) || DEFAULT_RULES.OVERTIME_MAX_YEAR

    for (const employee of employees || []) {
      // Get time events for the target date
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

      // Rule 1: MAX_DAILY_HOURS (dynamic from rule_sets)
      if (totalHours > MAX_DAILY_HOURS) {
        violations.push({
          company_id,
          employee_id: employee.id,
          rule_code: 'MAX_DAILY_HOURS',
          rule_version_id: ruleSetId || undefined,
          severity: getSeverity('MAX_DAILY_HOURS'),
          violation_date: targetDate,
          status: 'open',
          evidence_json: {
            rule_source: source,
            limit: MAX_DAILY_HOURS,
            actual: Math.round(totalHours * 100) / 100,
            sessions: sessions.map(s => ({
              entry: s.entry.local_timestamp,
              exit: s.exit?.local_timestamp,
              hours: s.hours
            }))
          }
        })
      }

      // Rule 2: BREAK_AFTER_HOURS (if worked > threshold without break)
      for (const session of sessions) {
        if (session.hours > BREAK_AFTER_HOURS) {
          violations.push({
            company_id,
            employee_id: employee.id,
            rule_code: 'BREAK_REQUIRED',
            rule_version_id: ruleSetId || undefined,
            severity: getSeverity('BREAK_AFTER_HOURS'),
            violation_date: targetDate,
            status: 'open',
            evidence_json: {
              rule_source: source,
              session_hours: Math.round(session.hours * 100) / 100,
              threshold_hours: BREAK_AFTER_HOURS,
              entry: session.entry.local_timestamp,
              exit: session.exit?.local_timestamp
            }
          })
        }
      }

      // Rule 3: MIN_DAILY_REST (check previous day's last exit to today's first entry)
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
          if (restHours < MIN_DAILY_REST) {
            violations.push({
              company_id,
              employee_id: employee.id,
              rule_code: 'MIN_DAILY_REST',
              rule_version_id: ruleSetId || undefined,
              severity: getSeverity('MIN_DAILY_REST'),
              violation_date: targetDate,
              status: 'open',
              evidence_json: {
                rule_source: source,
                required_hours: MIN_DAILY_REST,
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
      
      // Calculate standard hours based on working days
      const startDateObj = new Date(startOfYear)
      const endDateObj = new Date(targetDate)
      const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24))
      const workingDays = Math.floor(daysDiff * 5 / 7) // Approximate working days
      const standardHoursPerDay = (rules.MAX_WEEKLY_HOURS as number || 40) / 5
      const standardHours = workingDays * standardHoursPerDay
      const overtimeYTD = Math.max(0, ytdTotalHours - standardHours)

      // Overtime thresholds (75%, 90%, 100% of max)
      const overtime75 = OVERTIME_MAX_YEAR * 0.75
      const overtime90 = OVERTIME_MAX_YEAR * 0.9

      if (overtimeYTD > overtime75 && overtimeYTD <= overtime90) {
        violations.push({
          company_id,
          employee_id: employee.id,
          rule_code: 'OVERTIME_YTD_75',
          rule_version_id: ruleSetId || undefined,
          severity: 'warn',
          violation_date: targetDate,
          status: 'open',
          evidence_json: {
            rule_source: source,
            threshold_hours: overtime75,
            max_hours: OVERTIME_MAX_YEAR,
            overtime_ytd: Math.round(overtimeYTD * 100) / 100,
            percentage: Math.round((overtimeYTD / OVERTIME_MAX_YEAR) * 100)
          }
        })
      }

      if (overtimeYTD > overtime90 && overtimeYTD <= OVERTIME_MAX_YEAR) {
        violations.push({
          company_id,
          employee_id: employee.id,
          rule_code: 'OVERTIME_YTD_90',
          rule_version_id: ruleSetId || undefined,
          severity: 'critical',
          violation_date: targetDate,
          status: 'open',
          evidence_json: {
            rule_source: source,
            threshold_hours: overtime90,
            max_hours: OVERTIME_MAX_YEAR,
            overtime_ytd: Math.round(overtimeYTD * 100) / 100,
            percentage: Math.round((overtimeYTD / OVERTIME_MAX_YEAR) * 100)
          }
        })
      }

      if (overtimeYTD > OVERTIME_MAX_YEAR) {
        violations.push({
          company_id,
          employee_id: employee.id,
          rule_code: 'OVERTIME_YTD_CAP',
          rule_version_id: ruleSetId || undefined,
          severity: 'critical',
          violation_date: targetDate,
          status: 'open',
          evidence_json: {
            rule_source: source,
            limit_hours: OVERTIME_MAX_YEAR,
            overtime_ytd: Math.round(overtimeYTD * 100) / 100,
            excess_hours: Math.round((overtimeYTD - OVERTIME_MAX_YEAR) * 100) / 100
          }
        })
      }
    }

    // Check for weekly rest violations (run on Sundays or when explicitly requested)
    const dayOfWeek = new Date(targetDate).getDay()
    if (dayOfWeek === 0) { // Sunday
      for (const employee of employees || []) {
        const weekViolation = await checkWeeklyRest(supabase as any, company_id, employee.id, targetDate, MIN_WEEKLY_REST, source, ruleSetId)
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
        rule_source: source,
        effective_rules: rules,
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
  supabase: ReturnType<typeof createClient>,
  company_id: string,
  employee_id: string,
  targetDate: string,
  minWeeklyRest: number,
  ruleSource: string,
  ruleSetId: string | null
): Promise<Violation | null> {
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

  if (maxRestHours < minWeeklyRest) {
    return {
      company_id,
      employee_id,
      rule_code: 'MIN_WEEKLY_REST',
      rule_version_id: ruleSetId || undefined,
      severity: 'critical',
      violation_date: targetDate,
      status: 'open',
      evidence_json: {
        rule_source: ruleSource,
        required_hours: minWeeklyRest,
        max_rest_found: Math.round(maxRestHours * 100) / 100,
        week_start: weekStartStr,
        week_end: targetDate
      }
    }
  }

  return null
}
