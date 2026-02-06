import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { describeIntegration, getAnonClient } from './test_env';

describeIntegration('Cycle 5: Offline PWA + Sync', () => {
    const supabase = getAnonClient();

    it('Should sync offline events and prevent duplicates', async () => {
        // 1. Prepare offline events
        const offlineUuid = randomUUID();
        const employeeCode = process.env.TEST_KIOSK_EMPLOYEE_CODE || 'EMP001'; // Seed default
        const companyId = process.env.TEST_KIOSK_COMPANY_ID || 'c0000000-0000-0000-0000-000000000001';
        const pin = process.env.TEST_KIOSK_PIN;
        if (!pin) {
            console.warn('Skipping offline sync test: missing TEST_KIOSK_PIN');
            return;
        }
        const timestamp = new Date().toISOString();

        const events = [
            {
                offline_uuid: offlineUuid,
                employee_code: employeeCode,
                event_type: 'entry',
                local_timestamp: timestamp,
                auth_method: 'pin',
                auth_data: pin
            }
        ];

        // 2. Invoke sync action
        const { data: result, error } = await supabase.functions.invoke('kiosk-clock', {
            body: {
                action: 'sync_offline',
                events: events,
                company_id: companyId
            }
        });

        if (error) console.error('Sync error:', error);
        expect(error).toBeNull();
        expect(result.success).toBe(true);
        expect(result.synced).toBe(1);

        // 3. Sync same event again (should be treated as duplicate)
        const { data: result2 } = await supabase.functions.invoke('kiosk-clock', {
            body: {
                action: 'sync_offline',
                events: events,
                company_id: companyId
            }
        });

        expect(result2.success).toBe(true);
        expect(result2.results[0].success).toBe(true); // Already synced is success: true
        expect(result2.synced).toBe(1); // It counts as "synced" if existing
    });
});
