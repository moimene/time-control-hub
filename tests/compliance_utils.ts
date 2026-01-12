
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const COMPANY_ID = 'a0000000-0000-0000-0000-00000000000a'; // Bar El Rincón
export const EMPLOYEE_EMAIL = 'juan.martinez@elrincon.com';

export async function getEmployeeId(email: string = EMPLOYEE_EMAIL) {
    const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('email', email)
        .single();
    if (!emp) throw new Error(`Employee ${email} not found`);
    return emp.id;
}

export async function clearTestData(employeeId: string, date: string) {
    await supabase.from('time_events').delete().eq('employee_id', employeeId).gte('timestamp', `${date}T00:00:00Z`).lte('timestamp', `${date}T23:59:59Z`);
    await supabase.from('compliance_violations').delete().eq('employee_id', employeeId).eq('violation_date', date);
}

export async function insertEvents(employeeId: string, companyId: string, events: { type: string, time: string, date: string }[]) {
    const payloads = events.map(e => ({
        employee_id: employeeId,
        company_id: companyId,
        event_type: e.type,
        timestamp: `${e.date}T${e.time}:00Z`,
        local_timestamp: `${e.date}T${e.time}:00`
    }));
    const { error } = await supabase.from('time_events').insert(payloads);
    if (error) throw error;
}

export async function invokeEvaluator(companyId: string, date: string, employeeId?: string) {
    const { data, error } = await supabase.functions.invoke('compliance-evaluator', {
        body: { company_id: companyId, date, employee_id: employeeId }
    });
    if (error) throw error;
    return data;
}
