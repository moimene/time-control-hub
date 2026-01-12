import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

describe('Cycle 5: Offline PWA + Sync', () => {

    it('Should sync offline events and prevent duplicates', async () => {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // 1. Prepare offline events
        const offlineUuid = uuidv4();
        const employeeCode = 'EMP001'; // Juan Martinez
        const timestamp = new Date().toISOString();

        const events = [
            {
                offline_uuid: offlineUuid,
                employee_code: employeeCode,
                event_type: 'entry',
                local_timestamp: timestamp,
                auth_method: 'pin',
                auth_data: '1234'
            }
        ];

        // 2. Invoke sync action
        const { data: result, error } = await supabase.functions.invoke('kiosk-clock', {
            body: {
                action: 'sync_offline',
                events: events,
                company_id: 'c0000000-0000-0000-0000-000000000001'
            }
        });

        if (error) console.error('Sync error:', error);
        expect(result.success).toBe(true);
        expect(result.synced).toBe(1);

        // 3. Sync same event again (should be treated as duplicate)
        const { data: result2 } = await supabase.functions.invoke('kiosk-clock', {
            body: {
                action: 'sync_offline',
                events: events,
                company_id: 'c0000000-0000-0000-0000-000000000001'
            }
        });

        expect(result2.success).toBe(true);
        expect(result2.results[0].success).toBe(true); // Already synced is success: true
        expect(result2.synced).toBe(1); // It counts as "synced" if existing
    });
});
