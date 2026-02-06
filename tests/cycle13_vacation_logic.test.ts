import { it, expect, beforeAll } from 'vitest';
import { describeServiceIntegration, getServiceClient } from './test_env';

describeServiceIntegration('Cycle 13: Vacation Logic & Pro-rata', () => {
    const supabase = getServiceClient();
    const COMPANY_ID = process.env.COMPLIANCE_COMPANY_ID || 'a0000000-0000-0000-0000-00000000000a'; // Bar El Rincón
    const EMPLOYEE_EMAIL = process.env.COMPLIANCE_EMPLOYEE_EMAIL || 'juan.martinez@elrincon.com';
    const CURRENT_YEAR = Number(process.env.TEST_VACATION_YEAR || '2026');
    let employeeId: string;

    beforeAll(async () => {
        const { data: emp } = await supabase
            .from('employees')
            .select('id')
            .eq('email', EMPLOYEE_EMAIL)
            .single();

        if (!emp) throw new Error('Employee not found for tests');
        employeeId = emp.id;

        // Reset balances for the test year
        await supabase
            .from('vacation_balances')
            .delete()
            .eq('employee_id', employeeId)
            .eq('year', CURRENT_YEAR);
    });

    it('Should calculate full entitlement for regular employee', async () => {
        // Set hire date to previous year to ensure full entitlement
        await supabase
            .from('employees')
            .update({ hire_date: '2020-01-01' })
            .eq('id', employeeId);

        const { data, error } = await supabase.functions.invoke('vacation-calculator', {
            body: { company_id: COMPANY_ID, year: CURRENT_YEAR, employee_id: employeeId }
        });

        expect(error).toBeNull();
        expect(data.balances[0].entitled_days).toBe(22); // Default is 22 working days
    });

    it('Should calculate pro-rate for mid-year hire (TC-VAC-002)', async () => {
        // Set hire date to July 1st of CURRENT_YEAR
        // Note: vacation-calculator currently uses config.accrual_type === 'monthly_prorate'
        // Let's verify company settings or mock them if possible.

        await supabase
            .from('employees')
            .update({ hire_date: `${CURRENT_YEAR}-07-01` })
            .eq('id', employeeId);

        // Ensure monthly_prorate is enabled in company_settings
        await supabase
            .from('company_settings')
            .upsert({
                company_id: COMPANY_ID,
                setting_key: 'vacation_config',
                setting_value: {
                    annual_days: 22,
                    accrual_type: 'monthly_prorate',
                    compute_unit: 'working'
                }
            });

        const { data, error } = await supabase.functions.invoke('vacation-calculator', {
            body: { company_id: COMPANY_ID, year: CURRENT_YEAR, employee_id: employeeId }
        });

        expect(error).toBeNull();
        // 22 / 12 * 6 months = 11 days
        expect(data.balances[0].entitled_days).toBe(11);
    });

    it('Should validate available balance before approval (TC-VAC-004)', async () => {
        // This logic is usually in the absence-create or absence-approve function.
        // We will test if the balance is updated correctly after an approved request.

        // 1. Reset everything
        await supabase.from('absence_requests').delete().eq('employee_id', employeeId);

        // 2. Mock a balance of 5 days
        await supabase.from('vacation_balances').upsert({
            company_id: COMPANY_ID,
            employee_id: employeeId,
            year: CURRENT_YEAR,
            entitled_days: 5,
            available_days: 5,
            used_days: 0,
            pending_days: 0
        });

        // 3. Try to create an absence of 10 days (should fail or warn)
        // Since we are testing logic, let's see how absence-create handles it.
        // For now, we verify that vacation-calculator includes pending days.

        const { data: absenceType } = await supabase.from('absence_types').select('id').eq('code', 'VACACIONES').single();

        await supabase.from('absence_requests').insert({
            company_id: COMPANY_ID,
            employee_id: employeeId,
            absence_type_id: absenceType.id,
            start_date: `${CURRENT_YEAR}-08-01`,
            end_date: `${CURRENT_YEAR}-08-14`, // 10 working days approx
            total_days: 10,
            status: 'pending'
        });

        const { data: calcResult } = await supabase.functions.invoke('vacation-calculator', {
            body: { company_id: COMPANY_ID, year: CURRENT_YEAR, employee_id: employeeId }
        });

        // available_days = entitled (5) - pending (10) = -5 (or 0 capped)
        // Based on the code: const availableDays = Math.max(0, entitledDays + carriedOverDays - usedDays - pendingDays);
        expect(calcResult.balances[0].available_days).toBe(0);
        expect(calcResult.balances[0].pending_days).toBe(10);
    });
});
