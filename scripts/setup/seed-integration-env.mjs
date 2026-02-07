import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Prefer explicit env vars, then `.env`, then `.env.integration` (gitignored).
dotenv.config({ override: false, quiet: true });
dotenv.config({ path: '.env.integration', override: false, quiet: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
}
if (!supabaseServiceKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

function randomPassword() {
  // High-entropy printable password. Avoids embedding any credentials in source control.
  return crypto.randomBytes(24).toString('base64url');
}

function randomPin() {
  // 4-digit PIN (string). Stored only in the local `.env.integration` file (gitignored).
  return String(crypto.randomInt(0, 10000)).padStart(4, '0');
}

function computePinHash(pin, salt) {
  // Must match `supabase/functions/kiosk-clock` (SHA-256 of pin + salt, hex).
  return crypto.createHash('sha256').update(pin + salt).digest('hex');
}

function createAnonClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function createServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findUserIdByEmail(serviceClient, email) {
  // For this repo's test projects the user count is small; keep it simple and deterministic.
  const { data, error } = await serviceClient.auth.admin.listUsers({ perPage: 1000, page: 1 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  const match = (data?.users || []).find((u) => u.email === email);
  return match?.id || null;
}

async function ensureAuthUser(serviceClient, { email, password }) {
  const existingId = await findUserIdByEmail(serviceClient, email);
  if (existingId) {
    const { error } = await serviceClient.auth.admin.updateUserById(existingId, {
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`updateUserById failed (${email}): ${error.message}`);
    return existingId;
  }

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data?.user?.id) {
    throw new Error(`createUser failed (${email}): ${error?.message || 'unknown error'}`);
  }
  return data.user.id;
}

async function ensureRow(serviceClient, table, uniqueWhere, createValues, select = 'id') {
  const { data: existing, error: selectError } = await serviceClient
    .from(table)
    .select(select)
    .match(uniqueWhere)
    .limit(1)
    .maybeSingle();

  if (selectError) throw new Error(`select failed (${table}): ${selectError.message}`);
  if (existing) return existing;

  const { data: created, error: insertError } = await serviceClient
    .from(table)
    .insert(createValues)
    .select(select)
    .single();

  if (insertError) throw new Error(`insert failed (${table}): ${insertError.message}`);
  return created;
}

async function upsertRow(serviceClient, table, values, onConflict) {
  const { error } = await serviceClient.from(table).upsert(values, { onConflict });
  if (error) throw new Error(`upsert failed (${table}): ${error.message}`);
}

async function main() {
  const startedAt = new Date().toISOString();
  const serviceClient = createServiceClient();

  const companyName = process.env.INTEGRATION_COMPANY_NAME || 'Bar El Rincón';
  const companyCif = process.env.INTEGRATION_COMPANY_CIF || 'INT-TEST-BAR-001';

  const employeeCodePrefix = process.env.INTEGRATION_EMPLOYEE_CODE_PREFIX || 'BAR';
  const employeeCode = process.env.INTEGRATION_EMPLOYEE_CODE || `${employeeCodePrefix}001`;
  const otherEmployeeCode = process.env.INTEGRATION_OTHER_EMPLOYEE_CODE || `${employeeCodePrefix}002`;
  const employeePin = process.env.INTEGRATION_EMPLOYEE_PIN || randomPin();

  const terminalName = process.env.INTEGRATION_TERMINAL_NAME || 'Kiosco Integración';
  const terminalLocation = process.env.INTEGRATION_TERMINAL_LOCATION || 'Entrada';

  const adminEmail = process.env.INTEGRATION_ADMIN_EMAIL || 'integration.admin@timecontrol.test';
  const responsibleEmail =
    process.env.INTEGRATION_RESPONSIBLE_EMAIL || 'integration.responsible@timecontrol.test';
  const employeeEmail = process.env.INTEGRATION_EMPLOYEE_EMAIL || 'integration.employee@timecontrol.test';

  const adminPassword = randomPassword();
  const responsiblePassword = randomPassword();
  const employeePassword = randomPassword();

  // 1) Core tenant data
  const company = await ensureRow(
    serviceClient,
    'company',
    { cif: companyCif },
    {
      name: companyName,
      cif: companyCif,
      address: 'Integration Test Address',
      city: 'Madrid',
      postal_code: '28001',
      timezone: 'Europe/Madrid',
      employee_code_prefix: employeeCodePrefix,
    },
    'id, name, cif, timezone, employee_code_prefix',
  );

  // Keep prefix aligned even if the company existed already.
  await serviceClient
    .from('company')
    .update({ employee_code_prefix: employeeCodePrefix })
    .eq('id', company.id);

  // 2) Auth users (passwords rotated to random values)
  const adminUserId = await ensureAuthUser(serviceClient, { email: adminEmail, password: adminPassword });
  const responsibleUserId = await ensureAuthUser(serviceClient, {
    email: responsibleEmail,
    password: responsiblePassword,
  });
  const employeeUserId = await ensureAuthUser(serviceClient, {
    email: employeeEmail,
    password: employeePassword,
  });

  // 3) Roles
  await upsertRow(serviceClient, 'user_roles', { user_id: adminUserId, role: 'admin' }, 'user_id,role');
  await upsertRow(
    serviceClient,
    'user_roles',
    { user_id: responsibleUserId, role: 'responsible' },
    'user_id,role',
  );
  await upsertRow(
    serviceClient,
    'user_roles',
    { user_id: employeeUserId, role: 'employee' },
    'user_id,role',
  );

  // 4) Company assignment (tenant scope)
  await upsertRow(
    serviceClient,
    'user_company',
    { user_id: adminUserId, company_id: company.id },
    'user_id,company_id',
  );
  await upsertRow(
    serviceClient,
    'user_company',
    { user_id: responsibleUserId, company_id: company.id },
    'user_id,company_id',
  );
  await upsertRow(
    serviceClient,
    'user_company',
    { user_id: employeeUserId, company_id: company.id },
    'user_id,company_id',
  );

  // 5) Employees: one linked employee + one extra to validate employee isolation via RLS.
  const pinSalt = crypto.randomUUID();
  const pinHash = computePinHash(employeePin, pinSalt);

  const linkedEmployee = await ensureRow(
    serviceClient,
    'employees',
    { employee_code: employeeCode },
    {
      employee_code: employeeCode,
      first_name: 'Integration',
      last_name: 'Employee',
      email: employeeEmail,
      department: 'QA',
      position: 'Tester',
      status: 'active',
      company_id: company.id,
      user_id: employeeUserId,
      pin_hash: pinHash,
      pin_salt: pinSalt,
    },
    'id, employee_code, company_id, user_id',
  );

  await serviceClient
    .from('employees')
    .update({
      company_id: company.id,
      user_id: employeeUserId,
      email: employeeEmail,
      pin_hash: pinHash,
      pin_salt: pinSalt,
      pin_failed_attempts: 0,
      pin_locked_until: null,
    })
    .eq('id', linkedEmployee.id);

  await ensureRow(
    serviceClient,
    'employees',
    { employee_code: otherEmployeeCode },
    {
      employee_code: otherEmployeeCode,
      first_name: 'Other',
      last_name: 'Employee',
      email: 'other.employee@timecontrol.test',
      department: 'QA',
      position: 'Tester',
      status: 'active',
      company_id: company.id,
      pin_hash: crypto.randomBytes(16).toString('hex'),
      pin_salt: crypto.randomUUID(),
    },
    'id',
  );

  // 6) One active terminal so kiosk flows can be exercised end-to-end.
  const terminal = await ensureRow(
    serviceClient,
    'terminals',
    { company_id: company.id, name: terminalName },
    {
      company_id: company.id,
      name: terminalName,
      location: terminalLocation,
      status: 'active',
      settings: { seeded_by: 'scripts/setup/seed-integration-env.mjs', started_at: startedAt },
    },
    'id, name, location',
  );

  // Ensure terminal is active and correctly linked.
  await serviceClient
    .from('terminals')
    .update({ company_id: company.id, status: 'active', location: terminalLocation })
    .eq('id', terminal.id);

  // 7) Minimal time event so Cycle 6 can select an event under employee RLS.
  const now = new Date();
  const { error: timeEventError } = await serviceClient.from('time_events').insert({
    company_id: company.id,
    employee_id: linkedEmployee.id,
    event_type: 'entry',
    event_source: 'manual',
    timestamp: now.toISOString(),
    local_timestamp: now.toISOString(),
    timezone: 'Europe/Madrid',
    raw_payload: { seeded_by: 'scripts/setup/seed-integration-env.mjs', started_at: startedAt },
  });
  if (timeEventError) throw new Error(`insert time_events failed: ${timeEventError.message}`);

  // 8) Write `.env.integration` (ignored by git) for local integration runs.
  const integrationEnvPath = process.env.INTEGRATION_ENV_PATH || '.env.integration';
  const envLines = [
    '# Generated by scripts/setup/seed-integration-env.mjs',
    `# Seeded at: ${new Date().toISOString()}`,
    `VITE_SUPABASE_URL=${supabaseUrl}`,
    `VITE_SUPABASE_PUBLISHABLE_KEY=${supabaseAnonKey}`,
    '',
    'RUN_INTEGRATION_TESTS=true',
    '',
    `TEST_ADMIN_EMAIL=${adminEmail}`,
    `TEST_ADMIN_PASSWORD=${adminPassword}`,
    '',
    `TEST_RESPONSIBLE_EMAIL=${responsibleEmail}`,
    `TEST_RESPONSIBLE_PASSWORD=${responsiblePassword}`,
    '',
    `TEST_EMPLOYEE_EMAIL=${employeeEmail}`,
    `TEST_EMPLOYEE_PASSWORD=${employeePassword}`,
    '',
    `TEST_COMPANY_NAME=${companyName}`,
    `TEST_COMPANY_ID=${company.id}`,
    `TEST_EMPLOYEE_CODE_PREFIX=${employeeCodePrefix}`,
    `TEST_EMPLOYEE_CODE=${employeeCode}`,
    `TEST_EMPLOYEE_PIN=${employeePin}`,
    '',
    `TEST_KIOSK_COMPANY_ID=${company.id}`,
    `TEST_KIOSK_EMPLOYEE_CODE=${employeeCode}`,
    `TEST_KIOSK_PIN=${employeePin}`,
    `TEST_KIOSK_TERMINAL_ID=${terminal.id}`,
    `TEST_KIOSK_TERMINAL_NAME=${terminal.name}`,
    '',
  ];

  await fs.writeFile(path.resolve(integrationEnvPath), envLines.join('\n'), { encoding: 'utf8', mode: 0o600 });

  // 9) Sanity check: sign in with anon key using the new creds (no password output).
  const anonClient = createAnonClient();
  const { error: loginError } = await anonClient.auth.signInWithPassword({
    email: employeeEmail,
    password: employeePassword,
  });
  if (loginError) {
    throw new Error(`sanity login failed (employee): ${loginError.message}`);
  }
  await anonClient.auth.signOut();

  console.log('Seeded integration environment successfully.');
  console.log(`Company: ${company.name} (${company.id})`);
  console.log(`Users: ${adminEmail}, ${responsibleEmail}, ${employeeEmail}`);
  console.log(`Wrote local integration env to: ${path.resolve(integrationEnvPath)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Integration seed failed: ${message}`);
  process.exit(1);
});
