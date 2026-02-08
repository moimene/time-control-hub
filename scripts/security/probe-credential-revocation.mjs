import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Prefer explicit env vars, then `.env`, then `.env.integration` (gitignored).
dotenv.config({ override: false, quiet: true });
dotenv.config({ path: '.env.integration', override: false, quiet: true });

const DEFAULT_CREDENTIALS = [
  { label: 'super_admin_default', email: 'superadmin@timecontrol.com', password: 'super123' },
  { label: 'admin_elrincon_default', email: 'admin@elrincon.com', password: 'bar123' },
  { label: 'admin_zapateria_default', email: 'admin@zapateria-lopez.com', password: 'zap123' },
  { label: 'admin_dental_default', email: 'admin@dentalsonrisas.com', password: 'den123' },
  { label: 'admin_fisio_default', email: 'admin@fisio-wellness.com', password: 'fis123' },
  { label: 'responsable_elrincon_default', email: 'responsable@elrincon.com', password: 'resp123' },
  { label: 'responsable_zapateria_default', email: 'responsable@zapateria-lopez.com', password: 'resp123' },
  { label: 'responsable_dental_default', email: 'responsable@dentalsonrisas.com', password: 'resp123' },
  { label: 'responsable_fisio_default', email: 'responsable@fisio-wellness.com', password: 'resp123' },
  { label: 'responsable_test_default', email: 'responsable@test.com', password: 'resp123' },
  { label: 'employee_elrincon_default', email: 'juan.martinez@elrincon.com', password: 'emp123' },
  { label: 'employee_bar002_default', email: 'ana.lopez@elrincon.com', password: 'emp123' },
  { label: 'employee_zap001_default', email: 'lucia.moreno@zapateria-lopez.com', password: 'emp123' },
  { label: 'employee_zap002_default', email: 'roberto.navarro@zapateria-lopez.com', password: 'emp123' },
  { label: 'employee_den001_default', email: 'alberto.ruiz@dentalsonrisas.com', password: 'emp123' },
  { label: 'employee_den003_default', email: 'sofia.herrera@dentalsonrisas.com', password: 'emp123' },
  { label: 'employee_fis001_default', email: 'david.molina@fisio-wellness.com', password: 'emp123' },
  { label: 'employee_fis002_default', email: 'laura.gutierrez@fisio-wellness.com', password: 'emp123' },
  { label: 'fixture_admin_default', email: 'admin@test.com', password: 'admin123' },
  { label: 'fixture_employee_default', email: 'carlos.garcia@empresa.com', password: 'emp123' },
  { label: 'asesor_default', email: 'asesor@laboralconsulting.com', password: 'asesor123' },
];

function isRateLimitError(message) {
  return typeof message === 'string' && /rate limit/i.test(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCredentials() {
  const raw = process.env.CREDENTIAL_PROBE_LIST_JSON;
  if (!raw) return DEFAULT_CREDENTIALS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('CREDENTIAL_PROBE_LIST_JSON must be an array');
    }
    for (const item of parsed) {
      if (!item || typeof item !== 'object') {
        throw new Error('Each credential entry must be an object');
      }
      if (typeof item.email !== 'string' || typeof item.password !== 'string') {
        throw new Error('Each credential entry must include email and password strings');
      }
    }
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid CREDENTIAL_PROBE_LIST_JSON: ${message}`);
  }
}

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  const outputPath = process.env.CREDENTIAL_PROBE_OUTPUT || 'review/evidence/credential_revocation_probe_latest.json';
  const credentials = parseCredentials();

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const checkedAt = new Date().toISOString();
  const results = [];

  for (const credential of credentials) {
    let loginSucceeded = false;
    let errorMessage = null;
    let indeterminate = false;

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const { data, error } = await client.auth.signInWithPassword({
        email: credential.email,
        password: credential.password,
      });

      loginSucceeded = Boolean(data?.session) && !error;
      if (loginSucceeded) {
        await client.auth.signOut();
        errorMessage = null;
        break;
      }

      errorMessage = error?.message || 'Unknown authentication error';
      if (!isRateLimitError(errorMessage)) {
        break;
      }

      if (attempt < 4) {
        await sleep(1200 * attempt);
      } else {
        indeterminate = true;
      }
    }

    results.push({
      label: credential.label || credential.email,
      email: credential.email,
      login_succeeded: loginSucceeded,
      indeterminate,
      error: errorMessage,
    });
  }

  const active = results.filter((row) => row.login_succeeded);
  const indeterminateResults = results.filter((row) => row.indeterminate);
  const report = {
    checked_at: checkedAt,
    environment: {
      app_env: process.env.APP_ENV || process.env.ENV || process.env.NODE_ENV || 'unknown',
      supabase_url: supabaseUrl,
    },
    totals: {
      probed: results.length,
      active: active.length,
      indeterminate: indeterminateResults.length,
      revoked: results.length - active.length - indeterminateResults.length,
    },
    active_credentials: active,
    indeterminate_credentials: indeterminateResults,
    results,
  };

  const absoluteOutputPath = path.resolve(outputPath);
  await fs.mkdir(path.dirname(absoluteOutputPath), { recursive: true });
  await fs.writeFile(absoluteOutputPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Credential revocation probe report written to ${absoluteOutputPath}`);
  console.log(
    `Probed: ${report.totals.probed} | Active: ${report.totals.active} | Indeterminate: ${report.totals.indeterminate} | Revoked: ${report.totals.revoked}`,
  );

  if (report.totals.active > 0) {
    process.exit(1);
  }
  if (report.totals.indeterminate > 0) {
    process.exit(3);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Credential revocation probe failed: ${message}`);
  process.exit(2);
});
