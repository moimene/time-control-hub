import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');

// Historical migrations that contained flipped arguments but were later fixed by follow-up migrations.
const ALLOWED_FILES = new Set([
  '20260106073715_1a500aeb-77da-488b-8754-4092030864f3.sql',
  '20260106094329_9f538d80-3929-4c71-9573-32bcb5964304.sql',
]);

function isSqlFile(fileName) {
  return fileName.endsWith('.sql');
}

function findFlippedUserBelongsToCompany(lines) {
  const findings = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // Flipped: user_belongs_to_company(company_id, auth.uid())
    // Correct: user_belongs_to_company(auth.uid(), company_id)
    if (!/user_belongs_to_company\s*\(/.test(line)) continue;
    if (!/user_belongs_to_company\s*\([^,]+,\s*auth\.uid\(\)\s*\)/.test(line)) continue;
    findings.push({ line: i + 1, text: line.trim() });
  }
  return findings;
}

async function main() {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const sqlFiles = entries.filter((e) => e.isFile() && isSqlFile(e.name)).map((e) => e.name).sort();

  const findings = [];
  for (const fileName of sqlFiles) {
    const filePath = path.join(migrationsDir, fileName);
    const content = await fs.readFile(filePath, 'utf8');
    const fileFindings = findFlippedUserBelongsToCompany(content.split(/\r?\n/));
    for (const finding of fileFindings) {
      findings.push({ fileName, filePath, ...finding });
    }
  }

  if (findings.length === 0) {
    console.log('OK: No flipped user_belongs_to_company(<company_id>, auth.uid()) calls found in migrations.');
    return;
  }

  const nonAllowed = findings.filter((f) => !ALLOWED_FILES.has(f.fileName));

  console.log('Found flipped user_belongs_to_company calls:');
  for (const finding of findings) {
    const allowed = ALLOWED_FILES.has(finding.fileName);
    console.log(`- ${allowed ? '[allowed]' : '[ERROR]'} ${finding.fileName}:${finding.line} ${finding.text}`);
  }

  if (nonAllowed.length > 0) {
    console.error('');
    console.error(
      `ERROR: Flipped argument calls found outside allowlist (${nonAllowed.length}). New migrations must use user_belongs_to_company(auth.uid(), company_id).`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`RLS audit failed: ${message}`);
  process.exit(2);
});

