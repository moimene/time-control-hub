import { it, expect } from 'vitest';
import { describeServiceIntegration, getServiceClient } from './test_env';

describeServiceIntegration('Cycle 12: Retención & Purga', () => {

    it('Should correctly identify records for purge based on 4-year limit', async () => {
        const supabaseAdmin = getServiceClient();
        const companyId = process.env.TEST_RETENTION_COMPANY_ID || 'c0000000-0000-0000-0000-000000000001';

        // 1. Invoke purge in dry_run mode
        const { data: result, error } = await supabaseAdmin.functions.invoke('data-retention-purge', {
            body: {
                company_id: companyId,
                dry_run: true
            }
        });

        if (error) console.error('Purge error:', error);
        expect(error).toBeNull();
        expect(result.success).toBe(true);
        expect(result.dry_run).toBe(true);

        // 2. Verify cutoff date is approx 4 years ago
        const expectedYear = new Date().getFullYear() - 4;
        const resultCutoff = new Date(result.results[0].cutoff_date).getFullYear();
        expect(resultCutoff).toBe(expectedYear);
    });
});
