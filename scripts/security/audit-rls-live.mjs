import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

function createServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function findFlippedCalls(expression) {
  if (typeof expression !== 'string') return [];

  const findings = [];
  const lines = expression.split(/\r?\n/);
  for (const line of lines) {
    if (!/user_belongs_to_company\s*\(/.test(line)) continue;
    // Flipped: user_belongs_to_company(<company_id>, auth.uid())
    // Correct: user_belongs_to_company(auth.uid(), <company_id>)
    if (!/user_belongs_to_company\s*\([^,]+,\s*auth\.uid\(\)\s*\)/.test(line)) continue;
    findings.push(line.trim());
  }
  return findings;
}

async function main() {
  const startedAt = new Date().toISOString();
  const client = createServiceClient();

  const { data, error } = await client.rpc('security_rls_drift_snapshot');
  if (error) {
    throw new Error(`RPC security_rls_drift_snapshot failed: ${error.message}`);
  }

  const snapshot = data;

  const signatures = Array.isArray(snapshot?.function_signatures) ? snapshot.function_signatures : [];
  const ubtc = signatures.filter((s) => s?.name === 'user_belongs_to_company');
  const ubtcSignatureOk =
    ubtc.length === 1 && typeof ubtc[0]?.identity_args === 'string' && /_user_id\s+uuid.*_company_id\s+uuid/.test(ubtc[0].identity_args);

  const policies = Array.isArray(snapshot?.policies) ? snapshot.policies : [];

  const flipped = [];
  for (const policy of policies) {
    const qual = policy?.qual ?? null;
    const withCheck = policy?.with_check ?? null;

    const qualFindings = findFlippedCalls(qual);
    const checkFindings = findFlippedCalls(withCheck);

    if (qualFindings.length === 0 && checkFindings.length === 0) continue;

    flipped.push({
      schemaname: policy?.schemaname,
      tablename: policy?.tablename,
      policyname: policy?.policyname,
      cmd: policy?.cmd,
      qual: qualFindings,
      with_check: checkFindings,
    });
  }

  const report = {
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    environment: { supabase_url: supabaseUrl },
    results: {
      user_belongs_to_company_signature: ubtc.map((s) => s?.identity_args ?? null),
      user_belongs_to_company_signature_ok: ubtcSignatureOk,
      policies_total: policies.length,
      flipped_policies_total: flipped.length,
    },
    flipped_policies: flipped,
    raw_snapshot: snapshot,
  };

  const ts = startedAt.replace(/[:.]/g, '').replace('Z', 'Z');
  const outputPath =
    process.env.RLS_LIVE_AUDIT_OUTPUT ||
    `review/evidence/security_audit_rls_live_${ts}.json`;

  const absOutputPath = path.resolve(outputPath);
  await fs.mkdir(path.dirname(absOutputPath), { recursive: true });
  await fs.writeFile(absOutputPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`RLS live audit report written to ${absOutputPath}`);
  console.log(
    `Policies: ${report.results.policies_total} | Flipped: ${report.results.flipped_policies_total} | Signature OK: ${report.results.user_belongs_to_company_signature_ok}`,
  );

  if (!report.results.user_belongs_to_company_signature_ok) {
    process.exit(2);
  }
  if (report.results.flipped_policies_total > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`RLS live audit failed: ${message}`);
  process.exit(3);
});

