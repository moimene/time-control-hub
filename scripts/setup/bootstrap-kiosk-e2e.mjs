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

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
}

const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
if (!adminEmail || !adminPassword) {
  throw new Error('Missing TEST_ADMIN_EMAIL or TEST_ADMIN_PASSWORD (run the main seed first)');
}

const companyId = process.env.TEST_COMPANY_ID || process.env.TEST_KIOSK_COMPANY_ID;
if (!companyId) {
  throw new Error('Missing TEST_COMPANY_ID (run the main seed first)');
}

const employeeCode = process.env.TEST_EMPLOYEE_CODE || process.env.TEST_KIOSK_EMPLOYEE_CODE;
if (!employeeCode) {
  throw new Error('Missing TEST_EMPLOYEE_CODE (run the main seed first)');
}

function employeeCodePrefixFromCode(code) {
  const match = code.match(/^(.*?)(\d{3})$/);
  if (!match) {
    throw new Error(`Employee code must end with 3 digits (got: "${code}")`);
  }
  return match[1];
}

function randomPin() {
  return String(crypto.randomInt(0, 10000)).padStart(4, '0');
}

function computePinHash(pin, salt) {
  return crypto.createHash('sha256').update(pin + salt).digest('hex');
}

async function upsertEnvVars(envPath, updates) {
  const absPath = path.resolve(envPath);
  const raw = await fs.readFile(absPath, 'utf8');
  const lines = raw.split(/\r?\n/);

  const next = [];
  const seen = new Set();

  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      next.push(line);
      continue;
    }

    const key = match[1];
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      next.push(`${key}=${updates[key]}`);
      seen.add(key);
      continue;
    }

    next.push(line);
    seen.add(key);
  }

  // Ensure there's a blank line before appended keys for readability.
  if (next.length > 0 && next[next.length - 1] !== '') next.push('');

  for (const [key, value] of Object.entries(updates)) {
    if (seen.has(key)) continue;
    next.push(`${key}=${value}`);
  }

  if (next.length === 0 || next[next.length - 1] !== '') next.push('');
  await fs.writeFile(absPath, next.join('\n'), { encoding: 'utf8', mode: 0o600 });
}

async function main() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (authError || !authData.user) {
    throw new Error(`Failed to login as admin: ${authError?.message || 'unknown error'}`);
  }

  const employeeCodePrefix = employeeCodePrefixFromCode(employeeCode);

  // Ensure kiosk prefix matches the employee code convention used by the app PIN pad.
  const { error: companyError } = await supabase
    .from('company')
    .update({ employee_code_prefix: employeeCodePrefix })
    .eq('id', companyId);
  if (companyError) throw new Error(`Failed to update company employee_code_prefix: ${companyError.message}`);

  // Ensure there is at least one ACTIVE terminal for kiosk selection.
  const desiredTerminalName = process.env.INTEGRATION_TERMINAL_NAME || 'Kiosco E2E';
  const desiredTerminalLocation = process.env.INTEGRATION_TERMINAL_LOCATION || 'E2E';

  const { data: activeTerminals, error: terminalsError } = await supabase
    .from('terminals')
    .select('id, name, location, status')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1);
  if (terminalsError) throw new Error(`Failed to query terminals: ${terminalsError.message}`);

  let terminal = activeTerminals?.[0] || null;
  if (!terminal) {
    const { data: created, error: createError } = await supabase
      .from('terminals')
      .insert({
        company_id: companyId,
        name: desiredTerminalName,
        location: desiredTerminalLocation,
        status: 'active',
      })
      .select('id, name, location, status')
      .single();
    if (createError) throw new Error(`Failed to create terminal: ${createError.message}`);
    terminal = created;
  }

  // Set a valid PIN for the kiosk employee (no logging of the PIN).
  const employeePin = process.env.INTEGRATION_EMPLOYEE_PIN || randomPin();
  const pinSalt = crypto.randomUUID();
  const pinHash = computePinHash(employeePin, pinSalt);

  const { data: updatedEmployee, error: employeeError } = await supabase
    .from('employees')
    .update({
      pin_hash: pinHash,
      pin_salt: pinSalt,
      pin_failed_attempts: 0,
      pin_locked_until: null,
    })
    .match({ company_id: companyId, employee_code: employeeCode })
    .select('id')
    .maybeSingle();

  if (employeeError) throw new Error(`Failed to update employee PIN: ${employeeError.message}`);
  if (!updatedEmployee?.id) throw new Error('Employee not found or PIN update blocked by RLS');

  await supabase.auth.signOut();

  const envPath = process.env.INTEGRATION_ENV_PATH || '.env.integration';
  await upsertEnvVars(envPath, {
    TEST_EMPLOYEE_CODE_PREFIX: employeeCodePrefix,
    TEST_EMPLOYEE_PIN: employeePin,
    TEST_KIOSK_COMPANY_ID: companyId,
    TEST_KIOSK_EMPLOYEE_CODE: employeeCode,
    TEST_KIOSK_PIN: employeePin,
    TEST_KIOSK_TERMINAL_ID: terminal.id,
    TEST_KIOSK_TERMINAL_NAME: terminal.name,
  });

  console.log('Bootstrapped kiosk E2E successfully.');
  console.log(`Company: ${companyId}`);
  console.log(`Terminal: ${terminal.name} (${terminal.id})`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Kiosk E2E bootstrap failed: ${message}`);
  process.exit(1);
});
