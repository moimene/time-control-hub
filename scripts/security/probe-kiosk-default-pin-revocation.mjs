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

async function main() {
  const startedAt = new Date().toISOString();

  const serviceClient = createServiceClient();

  const results = [];
  for (const target of DEFAULT_KIOSK_PINS) {
    const row = {
      employee_code: target.employee_code,
      source: target.source,
      employee_id: null,
      company_id: null,
      default_pin_still_valid: false,
      missing: false,
      error: null,
    };

    try {
      const { data: employee, error: empError } = await serviceClient
        .from('employees')
        .select('id, company_id, pin_hash, pin_salt')
        .eq('employee_code', target.employee_code)
        .maybeSingle();

      if (empError) {
        throw new Error(empError.message);
      }
      if (!employee) {
        row.missing = true;
        results.push(row);
        continue;
      }

      row.employee_id = employee.id;
      row.company_id = employee.company_id;

      const pinSalt = String(employee.pin_salt || '');
      const storedHash = String(employee.pin_hash || '');
      const computedDefaultHash = sha256Hex(target.pin + pinSalt);
      row.default_pin_still_valid = storedHash.length > 0 && storedHash === computedDefaultHash;
    } catch (error) {
      row.error = error instanceof Error ? error.message : String(error);
    }

    results.push(row);
  }

  const active = results.filter((r) => r.default_pin_still_valid);
  const missing = results.filter((r) => r.missing);
  const errored = results.filter((r) => r.error);

  const report = {
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    environment: { supabase_url: supabaseUrl },
    totals: {
      probed: results.length,
      active_default_pins: active.length,
      missing: missing.length,
      errored: errored.length,
    },
    active,
    results,
  };

  const outputPath =
    process.env.KIOSK_PIN_PROBE_OUTPUT ||
    'review/evidence/kiosk_pin_default_revocation_probe_latest.json';

  const absOutputPath = path.resolve(outputPath);
  await fs.mkdir(path.dirname(absOutputPath), { recursive: true });
  await fs.writeFile(absOutputPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Kiosk default PIN revocation probe report written to ${absOutputPath}`);
  console.log(
    `Probed: ${report.totals.probed} | Active default pins: ${report.totals.active_default_pins} | Missing: ${report.totals.missing} | Errored: ${report.totals.errored}`,
  );

  if (report.totals.errored > 0) process.exit(2);
  if (report.totals.active_default_pins > 0) process.exit(1);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Kiosk PIN probe failed: ${message}`);
  process.exit(3);
});
