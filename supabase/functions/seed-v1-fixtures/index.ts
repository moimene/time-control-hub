import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// National holidays Spain 2026
const HOLIDAYS_2026 = [
    { date: '2026-01-01', description: 'Año Nuevo', type: 'national' },
    { date: '2026-01-06', description: 'Epifanía del Señor', type: 'national' },
    { date: '2026-04-02', description: 'Jueves Santo', type: 'national' },
    { date: '2026-04-03', description: 'Viernes Santo', type: 'national' },
    { date: '2026-05-01', description: 'Fiesta del Trabajo', type: 'national' },
    { date: '2026-08-15', description: 'Asunción de la Virgen', type: 'national' },
    { date: '2026-10-12', description: 'Fiesta Nacional de España', type: 'national' },
    { date: '2026-11-02', description: 'Todos los Santos (trasladado)', type: 'national' },
    { date: '2026-12-07', description: 'Día de la Constitución (trasladado)', type: 'national' },
    { date: '2026-12-08', description: 'Inmaculada Concepción', type: 'national' },
    { date: '2026-12-25', description: 'Natividad del Señor', type: 'national' },
    // Canary Islands specific (for Atlantic/Canary timezone test)
    { date: '2026-05-30', description: 'Día de Canarias', type: 'autonomous', region: 'canarias' },
];

// Test companies from TEST_PLAN_V1
const TEST_COMPANIES = [
    {
        name: 'Bar Pepe',
        cif: 'B12345678',
        sector: 'hosteleria',
        timezone: 'Europe/Madrid',
        employee_code_prefix: 'PEP',
        address: 'Calle Mayor 1',
        city: 'Madrid',
        postal_code: '28001',
    },
    {
        name: 'Clínica Vet',
        cif: 'B23456789',
        sector: 'sanidad_privada',
        timezone: 'Europe/Madrid',
        employee_code_prefix: 'VET',
        address: 'Avenida Salud 23',
        city: 'Barcelona',
        postal_code: '08001',
    },
    {
        name: 'Tienda Centro',
        cif: 'B34567890',
        sector: 'comercio',
        timezone: 'Atlantic/Canary', // Critical: DST test
        employee_code_prefix: 'TDA',
        address: 'Plaza Central 5',
        city: 'Las Palmas',
        postal_code: '35001',
    },
];

// Rule sets based on Spanish labor law
const DEFAULT_RULE_SETS = [
    {
        name: 'Estatuto de los Trabajadores',
        origin: 'law',
        status: 'active',
        rules: {
            MAX_DAILY_HOURS: 9,
            MAX_WEEKLY_HOURS: 40,
            MIN_DAILY_REST: 12,
            MIN_WEEKLY_REST: 36,
            BREAK_AFTER_HOURS: 6,
            BREAK_DURATION_MIN: 15,
            OVERTIME_MAX_YEAR: 80,
        },
    },
    {
        name: 'Convenio Hostelería',
        origin: 'collective_agreement',
        sector: 'hosteleria',
        status: 'active',
        rules: {
            MAX_DAILY_HOURS: 9,
            MAX_WEEKLY_HOURS: 40,
            MIN_DAILY_REST: 12,
            MIN_WEEKLY_REST: 36,
            BREAK_AFTER_HOURS: 6,
            BREAK_DURATION_MIN: 30, // More generous than law
            OVERTIME_MAX_YEAR: 80,
            SPLIT_SHIFT_ALLOWED: true,
            SPLIT_SHIFT_GAP_MAX: 4,
        },
    },
    {
        name: 'Convenio Comercio',
        origin: 'collective_agreement',
        sector: 'comercio',
        status: 'active',
        rules: {
            MAX_DAILY_HOURS: 9,
            MAX_WEEKLY_HOURS: 40,
            MIN_DAILY_REST: 12,
            MIN_WEEKLY_REST: 48, // More generous: full weekend
            BREAK_AFTER_HOURS: 6,
            BREAK_DURATION_MIN: 20,
            OVERTIME_MAX_YEAR: 80,
        },
    },
    {
        name: 'Convenio Sanidad Privada',
        origin: 'collective_agreement',
        sector: 'sanidad_privada',
        status: 'active',
        rules: {
            MAX_DAILY_HOURS: 10, // Allowed for healthcare
            MAX_WEEKLY_HOURS: 40,
            MIN_DAILY_REST: 11, // Slightly less due to sector needs
            MIN_WEEKLY_REST: 36,
            BREAK_AFTER_HOURS: 6,
            BREAK_DURATION_MIN: 15,
            OVERTIME_MAX_YEAR: 80,
            NIGHT_SHIFT_ALLOWED: true,
            NIGHT_SHIFT_MAX_CONSECUTIVE: 5,
        },
    },
];

async function hashPin(pin: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { clean = false, skip_companies = false, skip_holidays = false, skip_rules = false, skip_asesor = false } = await req.json().catch(() => ({}));

        const results: Record<string, unknown> = {};

        // Step 1: Create test companies
        if (!skip_companies) {
            console.log('Creating test companies...');
            const companyIds: Record<string, string> = {};

            for (const company of TEST_COMPANIES) {
                // Check if exists
                const { data: existing } = await supabase
                    .from('company')
                    .select('id')
                    .eq('cif', company.cif)
                    .maybeSingle();

                if (existing) {
                    companyIds[company.name] = existing.id;
                    console.log(`Company ${company.name} already exists`);
                } else {
                    const { data: created, error } = await supabase
                        .from('company')
                        .insert(company)
                        .select('id')
                        .single();

                    if (error) {
                        console.error(`Error creating company ${company.name}:`, error);
                    } else {
                        companyIds[company.name] = created.id;
                        console.log(`Created company ${company.name}`);
                    }
                }
            }

            results.companies = companyIds;

            // Step 1.5: Create default terminals for each company
            console.log('Creating default terminals...');
            for (const [name, id] of Object.entries(companyIds)) {
                const { data: existingTerminal } = await supabase
                    .from('terminals')
                    .select('id')
                    .eq('company_id', id)
                    .maybeSingle();

                if (!existingTerminal) {
                    await supabase.from('terminals').insert({
                        company_id: id,
                        name: 'Terminal Principal',
                        location: 'Provisionado Automáticamente',
                        status: 'active',
                        settings: { virtual: true, allow_all_employees: true }
                    });
                    console.log(`Created terminal for ${name}`);
                }
            }

            // Create employees for each company
            const employeeData = [
                {
                    company: 'Bar Pepe', employees: [
                        { first_name: 'Pedro', last_name: 'Camarero', pin: '1111' },
                        { first_name: 'Laura', last_name: 'Cocinera', pin: '2222' },
                        { first_name: 'Miguel', last_name: 'Barra', pin: '3333' },
                    ]
                },
                {
                    company: 'Clínica Vet', employees: [
                        { first_name: 'Dra. Ana', last_name: 'Veterinaria', pin: '4444' },
                        { first_name: 'Carlos', last_name: 'Auxiliar', pin: '5555' },
                    ]
                },
                {
                    company: 'Tienda Centro', employees: [
                        { first_name: 'Marta', last_name: 'Dependienta', pin: '6666' },
                        { first_name: 'José', last_name: 'Almacén', pin: '7777' },
                    ]
                },
            ];

            for (const { company, employees } of employeeData) {
                const companyId = companyIds[company];
                if (!companyId) continue;

                const prefix = TEST_COMPANIES.find(c => c.name === company)?.employee_code_prefix || 'EMP';

                for (let i = 0; i < employees.length; i++) {
                    const emp = employees[i];
                    const code = `${prefix}${String(i + 1).padStart(3, '0')}`;

                    const { data: existing } = await supabase
                        .from('employees')
                        .select('id')
                        .eq('company_id', companyId)
                        .eq('employee_code', code)
                        .maybeSingle();

                    if (!existing) {
                        const salt = generateSalt();
                        const pinHash = await hashPin(emp.pin, salt);

                        await supabase.from('employees').insert({
                            company_id: companyId,
                            employee_code: code,
                            first_name: emp.first_name,
                            last_name: emp.last_name,
                            email: `${emp.first_name.toLowerCase().replace(' ', '').replace('.', '')}.${emp.last_name.toLowerCase()}@test.com`,
                            status: 'active',
                            pin_hash: pinHash,
                            pin_salt: salt,
                        });
                        console.log(`Created employee ${code}`);
                    }
                }
            }
        }

        // Step 2: Load holidays for all companies
        if (!skip_holidays) {
            console.log('Loading 2026 holidays...');

            const { data: allCompanies } = await supabase.from('company').select('id, timezone');

            for (const company of allCompanies || []) {
                for (const holiday of HOLIDAYS_2026) {
                    // Skip autonomous holidays for non-matching regions
                    if (holiday.region && holiday.region !== 'canarias' && company.timezone !== 'Atlantic/Canary') {
                        continue;
                    }

                    const { data: existing } = await supabase
                        .from('calendar_holidays')
                        .select('id')
                        .eq('company_id', company.id)
                        .eq('holiday_date', holiday.date)
                        .maybeSingle();

                    if (!existing) {
                        await supabase.from('calendar_holidays').insert({
                            company_id: company.id,
                            holiday_date: holiday.date,
                            description: holiday.description,
                            holiday_type: holiday.type,
                            is_working_day: false,
                        });
                    }
                }
            }

            results.holidays = HOLIDAYS_2026.length;
        }

        // Step 3: Create rule sets
        if (!skip_rules) {
            console.log('Creating rule sets...');

            const { data: allCompanies } = await supabase.from('company').select('id, sector');

            for (const company of allCompanies || []) {
                // Add law-based rules (applies to all)
                const lawRules = DEFAULT_RULE_SETS.find(r => r.origin === 'law');
                if (lawRules) {
                    const { data: existing } = await supabase
                        .from('rule_sets')
                        .select('id')
                        .eq('company_id', company.id)
                        .eq('origin', 'law')
                        .maybeSingle();

                    if (!existing) {
                        await supabase.from('rule_sets').insert({
                            company_id: company.id,
                            name: lawRules.name,
                            origin: lawRules.origin,
                            status: 'active',
                            rules: lawRules.rules,
                            effective_from: '2026-01-01',
                        });
                    }
                }

                // Add sector-specific convention if exists
                const sectorRules = DEFAULT_RULE_SETS.find(r => r.sector === company.sector);
                if (sectorRules) {
                    const { data: existing } = await supabase
                        .from('rule_sets')
                        .select('id')
                        .eq('company_id', company.id)
                        .eq('origin', 'collective_agreement')
                        .maybeSingle();

                    if (!existing) {
                        await supabase.from('rule_sets').insert({
                            company_id: company.id,
                            name: sectorRules.name,
                            origin: sectorRules.origin,
                            status: 'active',
                            rules: sectorRules.rules,
                            effective_from: '2026-01-01',
                        });
                    }
                }
            }

            results.rules = 'created';
        }

        // Step 4: Create asesor user and assign to companies A and B
        if (!skip_asesor) {
            console.log('Creating asesor user...');

            const asesorEmail = 'asesor@laboralconsulting.com';
            const asesorPassword = 'asesor123';

            // Check if user exists
            const { data: existingUsers } = await supabase.auth.admin.listUsers();
            let asesorUser = existingUsers?.users?.find(u => u.email === asesorEmail);

            if (!asesorUser) {
                const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                    email: asesorEmail,
                    password: asesorPassword,
                    email_confirm: true,
                });

                if (createError) {
                    console.error('Error creating asesor:', createError);
                } else {
                    asesorUser = newUser.user;
                }
            }

            if (asesorUser) {
                // Add asesor role (if enum value exists)
                const { error: roleError } = await supabase
                    .from('user_roles')
                    .upsert({ user_id: asesorUser.id, role: 'asesor' }, { onConflict: 'user_id,role' });

                if (roleError) {
                    console.error('Error adding asesor role:', roleError);
                    // If asesor role doesn't exist yet, use 'responsible' as fallback
                    if (roleError.message.includes('invalid input value for enum')) {
                        console.log('Asesor role not in enum yet, skipping role assignment');
                    }
                }

                // Assign to first two test companies
                const { data: companies } = await supabase
                    .from('company')
                    .select('id, name')
                    .in('cif', ['B12345678', 'B23456789']);

                for (const company of companies || []) {
                    const { error: ucError } = await supabase
                        .from('user_company')
                        .upsert({ user_id: asesorUser.id, company_id: company.id }, { onConflict: 'user_id,company_id' });

                    if (ucError) {
                        console.error(`Error assigning asesor to ${company.name}:`, ucError);
                    } else {
                        console.log(`Assigned asesor to ${company.name}`);
                    }
                }

                results.asesor = {
                    email: asesorEmail,
                    password: asesorPassword,
                    assigned_companies: companies?.map(c => c.name),
                };
            }
        }

        // Step 5: Create correction requests test data
        console.log('Creating correction request test data...');

        const { data: someEmployee } = await supabase
            .from('employees')
            .select('id, company_id')
            .limit(3);

        if (someEmployee?.length) {
            const correctionStatuses = ['pending', 'approved', 'rejected'];

            for (let i = 0; i < someEmployee.length; i++) {
                const emp = someEmployee[i];
                const status = correctionStatuses[i];

                const { data: existing } = await supabase
                    .from('correction_requests')
                    .select('id')
                    .eq('employee_id', emp.id)
                    .limit(1);

                if (!existing?.length) {
                    const { error } = await supabase.from('correction_requests').insert({
                        employee_id: emp.id,
                        company_id: emp.company_id,
                        reason: `Test correction request - ${status}`,
                        status,
                        requested_event_type: 'entry',
                        requested_timestamp: new Date().toISOString(),
                    });

                    if (error) {
                        console.error('Error creating correction request:', error);
                    }
                }
            }

            results.corrections = 'created';
        }

        // Step 6: Create sample compliance violations for testing
        console.log('Creating compliance violation test data...');

        if (someEmployee?.length) {
            const violationTypes = [
                { rule_code: 'MAX_DAILY_HOURS', severity: 'critical' },
                { rule_code: 'MIN_DAILY_REST', severity: 'critical' },
                { rule_code: 'OVERTIME_YTD_75', severity: 'warn' },
            ];

            for (const emp of someEmployee) {
                for (const vt of violationTypes) {
                    const violationDate = new Date();
                    violationDate.setDate(violationDate.getDate() - Math.floor(Math.random() * 7));

                    const { data: existing } = await supabase
                        .from('compliance_violations')
                        .select('id')
                        .eq('employee_id', emp.id)
                        .eq('rule_code', vt.rule_code)
                        .limit(1);

                    if (!existing?.length) {
                        await supabase.from('compliance_violations').insert({
                            company_id: emp.company_id,
                            employee_id: emp.id,
                            rule_code: vt.rule_code,
                            severity: vt.severity,
                            status: 'open',
                            violation_date: violationDate.toISOString().split('T')[0],
                            evidence_json: {
                                test: true,
                                generated_by: 'seed-v1-fixtures',
                            },
                        });
                    }
                }
            }

            results.violations = 'created';
        }

        console.log('Seed complete:', results);

        return new Response(JSON.stringify({
            success: true,
            message: 'V1 fixtures created successfully',
            results,
            credentials: {
                asesor: { email: 'asesor@laboralconsulting.com', password: 'asesor123', url: '/admin' },
                test_companies: TEST_COMPANIES.map(c => ({ name: c.name, cif: c.cif, timezone: c.timezone })),
                pins: {
                    'Bar Pepe': ['PEP001:1111', 'PEP002:2222', 'PEP003:3333'],
                    'Clínica Vet': ['VET001:4444', 'VET002:5555'],
                    'Tienda Centro': ['TDA001:6666', 'TDA002:7777'],
                },
            },
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Seed error:', error);
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
