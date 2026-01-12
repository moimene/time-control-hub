import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

describe('Cycle 10: Reporting + ITSS Package', () => {

    it('Should generate a full ITSS package with manifest and hashes', async () => {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Signing as admin
        await supabase.auth.signInWithPassword({
            email: 'admin@bar-el-rincon.com',
            password: 'bar123'
        });

        // 1. Invoke ITSS generation
        const { data: result, error } = await supabase.functions.invoke('generate-itss-package', {
            body: {
                company_id: 'c0000000-0000-0000-0000-000000000001',
                period_start: '2026-01-01',
                period_end: '2026-01-31',
                components: {
                    daily_record: true,
                    labor_calendar: true,
                    policies: true,
                    contract_summary: true
                },
                dry_run: true // Test without saving to DB for now
            }
        });

        if (error) console.error('ITSS error:', error);
        expect(result.success).toBe(true);
        expect(result.manifest).toBeDefined();
        expect(result.manifest.integrity.package_hash).toBeDefined();

        // 2. Verify deliverables structure
        const dailyRecord = result.manifest.deliverables.find(d => d.name === 'registro_diario.csv');
        expect(dailyRecord).toBeDefined();
        expect(dailyRecord.sha256).toHaveLength(64);
    });
});
