import { it, expect } from 'vitest';
import { describeServiceIntegration, getServiceClient } from './test_env';

describeServiceIntegration('Cycle 2: Onboarding "Preconfigurado"', () => {

    it('Should create default rule sets when bootstrapping a company', async () => {
        const supabaseAdmin = getServiceClient();

        // 1. Create a dummy company for testing onboarding
        const { data: company } = await supabaseAdmin.from('company').insert({
            name: 'Test Onboarding Corp',
            sector: 'hostelería'
        }).select().single();

        expect(company).toBeDefined();

        // 2. Invoke bootstrap
        const { data: result } = await supabaseAdmin.functions.invoke('company-bootstrap', {
            body: { company_id: company.id }
        });

        expect(result.success).toBe(true);
        expect(result.results.rule_sets.success).toBe(true);

        // 3. Verify rule_sets exist for this company
        const { data: ruleSets } = await supabaseAdmin.from('rule_sets')
            .select('id')
            .eq('company_id', company.id);

        expect(ruleSets?.length).toBeGreaterThan(0);

        // 4. Verify assignments
        const { data: assignments } = await supabaseAdmin.from('rule_assignments')
            .select('id')
            .eq('company_id', company.id);

        expect(assignments?.length).toBeGreaterThan(0);

        // Cleanup
        await supabaseAdmin.from('company').delete().eq('id', company.id);
    });
});
