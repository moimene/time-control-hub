import { it, expect } from 'vitest';
import { describeServiceIntegration, getServiceClient } from './test_env';

describeServiceIntegration('Cycle 7: Inconsistencias + Alertas', () => {
    const supabaseAdmin = getServiceClient();

    it('Should trigger an alert when an orphan entry is detected', async () => {
        // 1. Find an employee
        const { data: employee } = await supabaseAdmin.from('employees').select('id, company_id').limit(1).single();

        // 2. Create an orphan entry from 25 hours ago
        const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
        const { data: entry } = await supabaseAdmin.from('time_events').insert({
            employee_id: employee.id,
            company_id: employee.company_id,
            event_type: 'entry',
            timestamp: oldTimestamp,
            local_timestamp: oldTimestamp,
            origin: 'kiosk'
        }).select().single();

        // 3. Invoke orphan-alert
        const { data: result, error: invokeError } = await supabaseAdmin.functions.invoke('orphan-alert');

        expect(invokeError).toBeNull();
        expect(result.success).toBe(true);
        expect(result.total_orphans).toBeGreaterThan(0);

        // 4. Cleanup
        await supabaseAdmin.from('time_events').delete().eq('id', entry.id);
    });
});
