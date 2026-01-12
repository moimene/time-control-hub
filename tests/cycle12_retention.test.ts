import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe('Cycle 12: Retención & Purga', () => {

    it('Should correctly identify records for purge based on 4-year limit', async () => {
        if (!supabaseServiceKey) {
            console.warn('Skipping Cycle 12 test: SUPABASE_SERVICE_ROLE_KEY missing');
            return;
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Invoke purge in dry_run mode
        const { data: result, error } = await supabaseAdmin.functions.invoke('data-retention-purge', {
            body: {
                company_id: 'c0000000-0000-0000-0000-000000000001',
                dry_run: true
            }
        });

        if (error) console.error('Purge error:', error);
        expect(result.success).toBe(true);
        expect(result.dry_run).toBe(true);

        // 2. Verify cutoff date is approx 4 years ago
        const expectedYear = new Date().getFullYear() - 4;
        const resultCutoff = new Date(result.results[0].cutoff_date).getFullYear();
        expect(resultCutoff).toBe(expectedYear);
    });
});
