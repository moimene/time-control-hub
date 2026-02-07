import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, requireAnyRole, requireCallerContext, requireCompanyAccess } from "../_shared/auth.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isFixtureEnvironmentAllowed(req: Request): boolean {
    const explicitFlag = Deno.env.get('ALLOW_TEST_FIXTURES') === 'true';
    const appEnv = (
        Deno.env.get('APP_ENV') ||
        Deno.env.get('ENV') ||
        Deno.env.get('NODE_ENV') ||
        ''
    ).toLowerCase();
    const nonProdEnv = ['dev', 'development', 'local', 'test', 'staging', 'preview'];
    const requestHost = new URL(req.url).hostname;
    const localHost = requestHost === 'localhost' || requestHost === '127.0.0.1';

    return explicitFlag || nonProdEnv.includes(appEnv) || localHost;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        if (!isFixtureEnvironmentAllowed(req)) {
            return jsonResponse({ error: 'Fixture seeding is disabled in this environment' }, 403, corsHeaders);
        }

        const caller = await requireCallerContext({
            req,
            supabaseAdmin,
            corsHeaders,
            allowServiceRole: true,
        });
        if (caller instanceof Response) return caller;
        if (caller.kind === 'user') {
            const roleError = requireAnyRole({ ctx: caller, allowed: ['super_admin'], corsHeaders });
            if (roleError) return roleError;
        }

        const { company_id } = await req.json();

        if (!company_id) {
            return jsonResponse({ error: 'company_id is required' }, 400, corsHeaders);
        }

        if (caller.kind === 'user') {
            const companyAccess = await requireCompanyAccess({
                supabaseAdmin,
                ctx: caller,
                companyId: company_id,
                corsHeaders,
                allowEmployee: true,
            });
            if (companyAccess instanceof Response) return companyAccess;
        }

        console.log(`Seeding compliance data for company: ${company_id}`);
        const results: Record<string, any> = {};

        // 1. Get employees
        const { data: employees, error: empError } = await supabaseAdmin
            .from('employees')
            .select('id')
            .eq('company_id', company_id);

        if (empError) throw empError;
        if (!employees || employees.length === 0) {
            throw new Error('No employees found for this company');
        }

        // 2. Seed Vacation Balances (Module 8)
        console.log('Seeding vacation balances...');
        const currentYear = new Date().getFullYear();
        const vacationData = employees.map(emp => ({
            company_id,
            employee_id: emp.id,
            year: currentYear,
            entitled_days: 22,
            used_days: Math.floor(Math.random() * 5),
        }));

        const { error: vacError } = await supabaseAdmin
            .from('vacation_balances')
            .upsert(vacationData, { onConflict: 'company_id,employee_id,year' });

        if (vacError) console.error('Error seeding vacations:', vacError);
        results.vacations = !vacError;

        // 3. Seed Absence Types and Requests (Module 9)
        console.log('Seeding absences...');
        const { data: existingTypes } = await supabaseAdmin
            .from('absence_types')
            .select('id')
            .eq('company_id', company_id)
            .eq('code', 'VAC');

        let typeId;
        if (!existingTypes || existingTypes.length === 0) {
            const { data: newType, error: typeError } = await supabaseAdmin
                .from('absence_types')
                .insert({
                    company_id,
                    code: 'VAC',
                    name: 'Vacaciones Anuales',
                    category: 'vacation',
                    is_paid: true,
                })
                .select('id')
                .single();
            if (typeError) console.error('Error seeding absence type:', typeError);
            typeId = newType?.id;
        } else {
            typeId = existingTypes[0].id;
        }

        if (typeId) {
            const absenceData = employees.slice(0, 3).map(emp => ({
                company_id,
                employee_id: emp.id,
                absence_type_id: typeId,
                start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                total_days: 3,
                status: 'approved',
            }));

            const { error: absReqError } = await supabaseAdmin
                .from('absence_requests')
                .insert(absenceData);

            if (absReqError) console.error('Error seeding absence requests:', absReqError);
            results.absences = !absReqError;
        }

        // 4. Seed Default Rule Sets (Module 10 & 11)
        console.log('Seeding rule templates...');
        const { data: ruleResults, error: rpcError } = await supabaseAdmin.rpc('seed_default_rule_sets', {
            p_company_id: company_id
        });

        if (rpcError) console.error('Error calling seed_default_rule_sets:', rpcError);
        results.rules = !rpcError && ruleResults?.success;

        // 5. Seed ITSS Package (Module 15)
        console.log('Seeding ITSS package...');
        const { error: itssError } = await supabaseAdmin
            .from('itss_packages')
            .insert({
                company_id,
                period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                period_end: new Date().toISOString().split('T')[0],
                status: 'generated',
                generated_at: new Date().toISOString(),
                components: { excel: true, pdf: true, signature: true },
            });

        if (itssError) console.error('Error seeding ITSS package:', itssError);
        results.itss = !itssError;

        return new Response(JSON.stringify({
            success: true,
            results
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
