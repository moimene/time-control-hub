import { it, expect } from 'vitest';
import { describeIntegration, getAnonClient, requireCredential } from './test_env';

describeIntegration('Cycle 10: Reporting + ITSS Package', () => {

    it('Should generate a full ITSS package with manifest and hashes', async () => {
        const supabase = getAnonClient();
        const adminCred = requireCredential('TEST_ADMIN');
        const companyId = process.env.TEST_ITSS_COMPANY_ID || 'c0000000-0000-0000-0000-000000000001';

        // Signing as admin
        const { error: loginError } = await supabase.auth.signInWithPassword(adminCred);
        expect(loginError).toBeNull();

        // 1. Invoke ITSS generation
        const { data: result, error } = await supabase.functions.invoke('generate-itss-package', {
            body: {
                company_id: companyId,
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

        if (error) {
            console.error('ITSS error:', error);
        }
        expect(error).toBeNull();
        expect(result?.success).toBe(true);
        expect(result?.manifest).toBeDefined();
        expect(result?.manifest?.integrity?.package_hash).toBeDefined();

        // 2. Verify deliverables structure
        const dailyRecord = result!.manifest.deliverables.find((d: any) => d.name === 'registro_diario.csv');
        expect(dailyRecord).toBeDefined();
        expect(dailyRecord.sha256).toHaveLength(64);
    });
});
