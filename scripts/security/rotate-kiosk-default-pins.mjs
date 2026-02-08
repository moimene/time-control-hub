import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Prefer explicit env vars, then `.env`, then `.env.integration` (gitignored).
dotenv.config({ override: false, quiet: true });
dotenv.config({ path: '.env.integration', override: false, quiet: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

// Known exposed kiosk codes/PINs from seed/test artifacts (public repo).
const DEFAULT_KIOSK_PINS = [
  // src/pages/TestCredentials.tsx
  { employee_code: 'BAR001', pin: '1234', source: 'src/pages/TestCredentials.tsx' },
  { employee_code: 'BAR002', pin: '2345', source: 'src/pages/TestCredentials.tsx' },
  { employee_code: 'BAR003', pin: '3456', source: 'src/pages/TestCredentials.tsx' },
  { employee_code: 'BAR004', pin: '4567', source: 'src/pages/TestCredentials.tsx' },
  { employee_code: 'BAR005', pin: '5678', source: 'src/pages/TestCredentials.tsx' },
  { employee_code: 'ZAP001', pin: '1111', source: 'src/pages/TestCredentials.tsx' },
  { employee_code: 'ZAP002', pin: '2222', source: 'src/pages/TestCredentials.tsx' },
  { employee_code: 'ZAP003', pin: '3333', source: 'src/pages/TestCredentials.tsx' },
  { employee_code: 'ZAP004', pin: '4444', source: 'src/pages/TestCredentials.tsx' },
  { employee_code: 'DEN001', pin: '1212', source: 'src/pages/TestCredentials.tsx' },
  { employee_code: 'DEN002', pin: '2323', source: 'src/pages/TestCredentials.tsx' },
  { employee_code: 'DEN003', pin: '3434', source: 'src/pages/TestCredentials.tsx' },
  { employee_code: 'DEN004', pin: '4545', source: 'src/pages/TestCredentials.tsx' },
  { employee_code: 'DEN005', pin: '5656', source: 'src/pages/TestCredentials.tsx' },
  { employee_code: 'FIS001', pin: '6666', source: 'src/pages/TestCredentials.tsx' },
  { employee_code: 'FIS002', pin: '7777', source: 'src/pages/TestCredentials.tsx' },
  { employee_code: 'FIS003', pin: '8888', source: 'src/pages/TestCredentials.tsx' },
  { employee_code: 'FIS004', pin: '9999', source: 'src/pages/TestCredentials.tsx' },

  // supabase/functions/setup-test-users/index.ts
  { employee_code: 'EMP001', pin: '1234', source: 'supabase/functions/setup-test-users/index.ts' },
  { employee_code: 'EMP002', pin: '2345', source: 'supabase/functions/setup-test-users/index.ts' },
  { employee_code: 'EMP003', pin: '3456', source: 'supabase/functions/setup-test-users/index.ts' },
];

function createServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function generateNewPin(oldPin, usedPins) {
  // Avoid low-entropy or commonly used pins and the known defaults.
  const banned = new Set([
    '0000',
    '1111',
    '1212',
    '1234',
    '2222',
    '2323',
    '3333',
    '3434',
    '4444',
    '4545',
    '5555',
    '5656',
    '6666',
    '7777',
    '8888',
    '9999',
  ]);
  banned.add(oldPin);

  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const candidate = String(crypto.randomInt(0, 10000)).padStart(4, '0');
    if (banned.has(candidate)) continue;
    if (usedPins.has(candidate)) continue;
    usedPins.add(candidate);
    return candidate;
  }

  throw new Error('Unable to generate a new kiosk PIN after many attempts');
}

async function main() {
  const startedAt = new Date().toISOString();
  const serviceClient = createServiceClient();

  const usedPins = new Set();
  const report = {
    started_at: startedAt,
    finished_at: null,
    environment: { supabase_url: supabaseUrl },
    totals: { targeted: DEFAULT_KIOSK_PINS.length, rotated: 0, missing: 0, failed: 0 },
    results: [],
  };

  for (const target of DEFAULT_KIOSK_PINS) {
    const row = {
      employee_code: target.employee_code,
      source: target.source,
      rotated: false,
      missing: false,
      employee_id: null,
      company_id: null,
      old_pin_hash_prefix: null,
      new_pin_hash_prefix: null,
      error: null,
    };

    try {
      const { data: employee, error: empError } = await serviceClient
        .from('employees')
        .select('id, company_id, pin_hash, pin_salt')
        .eq('employee_code', target.employee_code)
        .maybeSingle();

      if (empError) {
        throw new Error(`employee lookup failed: ${empError.message}`);
      }

      if (!employee) {
        row.missing = true;
        report.totals.missing += 1;
        report.results.push(row);
        continue;
      }

      row.employee_id = employee.id;
      row.company_id = employee.company_id;
      row.old_pin_hash_prefix = String(employee.pin_hash || '').slice(0, 10) || null;

      const newPin = generateNewPin(target.pin, usedPins);
      const newSalt = crypto.randomUUID();
      const newHash = sha256Hex(newPin + newSalt);

      const { error: updateError } = await serviceClient
        .from('employees')
        .update({
          pin_hash: newHash,
          pin_salt: newSalt,
          pin_failed_attempts: 0,
          pin_locked_until: null,
        })
        .eq('id', employee.id);

      if (updateError) {
        throw new Error(`employee update failed: ${updateError.message}`);
      }

      row.new_pin_hash_prefix = newHash.slice(0, 10);
      row.rotated = true;
      report.totals.rotated += 1;

      // Note: we intentionally do NOT record the new PIN in the report to avoid leaking secrets.
      // If you need to distribute new PINs, run a dedicated secure workflow out of band.
    } catch (error) {
      row.error = error instanceof Error ? error.message : String(error);
      report.totals.failed += 1;
    }

    report.results.push(row);
  }

  report.finished_at = new Date().toISOString();

  const outputPath =
    process.env.KIOSK_PIN_ROTATION_OUTPUT ||
    'review/evidence/kiosk_pin_rotation_run_2026-02-06.json';

  const absOutputPath = path.resolve(outputPath);
  await fs.mkdir(path.dirname(absOutputPath), { recursive: true });
  await fs.writeFile(absOutputPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Kiosk PIN rotation report written to ${absOutputPath}`);
  console.log(`Targeted: ${report.totals.targeted} | Rotated: ${report.totals.rotated} | Missing: ${report.totals.missing} | Failed: ${report.totals.failed}`);

  if (report.totals.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Kiosk PIN rotation failed: ${message}`);
  process.exit(2);
});
