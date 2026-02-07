
import { it, expect } from 'vitest';
import { type SupabaseClient } from '@supabase/supabase-js';
import { describeIntegration, getAnonClient, getCredential, requireCredential } from './test_env';

// Helper to create a client for a specific user
const getClient = async (email: string, password: string): Promise<SupabaseClient> => {
    const supabase = getAnonClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`Failed to login as ${email}: ${error.message}`);
    return supabase;
};

describeIntegration('Cycle 1: Multi-tenant & Role-based Access Control', () => {
    const expectedCompanyName = process.env.TEST_COMPANY_NAME || 'Bar El Rincón';
    const adminCred = requireCredential('TEST_ADMIN');
    const employeeCred = requireCredential('TEST_EMPLOYEE');
    const asesorCred = getCredential('TEST_ASESOR');
    const superAdminCred = getCredential('TEST_SUPERADMIN');

    describe('Company Isolation (Anti-Leak)', () => {
        it('Admin of Bar El Rincón should NOT see Zapatería López employees', async () => {
            const client = await getClient(adminCred.email, adminCred.password);

            const { data: companies } = await client.from('company').select('id, name');
            expect(companies?.length).toBe(1);
            expect(companies?.[0].name).toBe(expectedCompanyName);
            const barRinconId = companies?.[0].id;

            const { data: employees } = await client.from('employees').select('company_id, last_name, email');
            console.log(`Admin of Bar El Rincón found ${employees?.length} employees:`, employees?.map(e => `${e.last_name} (${e.email})`).join(', '));

            // All visible employees must belong to Bar El Rincón
            employees?.forEach(emp => {
                expect(emp.company_id).toBe(barRinconId);
            });
        });

        it('Employee should ONLY see their own data in sensitive tables', async () => {
            const client = await getClient(employeeCred.email, employeeCred.password);

            // Should not see other employees
            const { data: employees } = await client.from('employees').select('id');
            expect(employees?.length).toBe(1); // Only self

            // Should not see company settings
            const { data: settings } = await client.from('company_settings').select('*');
            expect(settings?.length).toBe(0);
        });
    });

    describe('Adviser Role (Cross-tenant)', () => {
        it('Asesor should see multiple companies if assigned', async () => {
            if (!asesorCred) {
                console.warn('Asesor test skipped: missing TEST_ASESOR_EMAIL/TEST_ASESOR_PASSWORD');
                return;
            }

            const client = await getClient(asesorCred.email, asesorCred.password);
            const { data: companies } = await client.from('company').select('name');

            expect(companies?.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Super Admin Access', () => {
        it('Super Admin should see ALL companies', async () => {
            if (!superAdminCred) {
                console.warn('Super admin test skipped: missing TEST_SUPERADMIN_EMAIL/TEST_SUPERADMIN_PASSWORD');
                return;
            }

            const client = await getClient(superAdminCred.email, superAdminCred.password);

            const { data: companies } = await client.from('company').select('name');
            // Should see at least the 4 companies + any others
            expect((companies?.length || 0)).toBeGreaterThanOrEqual(4);
        });
    });
});
