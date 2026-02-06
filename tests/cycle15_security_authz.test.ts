import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const currentFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(currentFilePath);
const repoRoot = path.resolve(testsDir, '..');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const runLiveEndpointChecks = process.env.RUN_REMOTE_SECURITY_REGRESSION === 'true';

const fixturesFunctions = [
  'setup-test-users',
  'setup-test-data',
  'seed-v1-fixtures',
  'get-test-credentials',
];

function readRepoFile(relativePath: string): string {
  const absolutePath = path.join(repoRoot, relativePath);
  return readFileSync(absolutePath, 'utf8');
}

function expectGuardWithStatus(source: string, messageFragment: string, statusCode: number): void {
  expect(source).toContain(messageFragment);
  const pattern = new RegExp(`${messageFragment.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}[\\s\\S]{0,220}${statusCode}`);
  expect(source).toMatch(pattern);
}

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const record = error as Record<string, unknown>;
  if (typeof record.status === 'number') {
    return record.status;
  }
  if (record.context instanceof Response) {
    return record.context.status;
  }
  return null;
}

function createAnonClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe('Cycle 15: Security Regression (Lote 1) - source contract', () => {
  it('supabase config should keep verify_jwt=false only for kiosk exceptions', () => {
    const configToml = readRepoFile('supabase/config.toml');
    const entries = Array.from(
      configToml.matchAll(/\[functions\.([^\]]+)\]\s*\nverify_jwt = (true|false)/g),
    ).map((match) => ({ functionName: match[1], verifyJwt: match[2] === 'true' }));

    expect(entries.length).toBeGreaterThan(0);
    const verifyJwtFalse = entries
      .filter((entry) => !entry.verifyJwt)
      .map((entry) => entry.functionName)
      .sort();

    expect(verifyJwtFalse).toEqual(['kiosk-auth', 'kiosk-clock']);
  });

  it('generate-itss-package should contain auth and authorization 401/403 guards', () => {
    const source = readRepoFile('supabase/functions/generate-itss-package/index.ts');

    expect(source).toContain('supabase.auth.getUser(token)');
    expect(source).toContain('.from(\'user_roles\')');
    expect(source).toContain('Insufficient permissions');
    expect(source).toContain('User not assigned to requested company');
    expectGuardWithStatus(source, 'Missing Authorization header', 401);
    expectGuardWithStatus(source, 'Invalid Authorization token', 401);
    expectGuardWithStatus(source, 'Insufficient permissions', 403);
  });

  it('absence-create should contain auth, role and tenant 401/403 guards', () => {
    const source = readRepoFile('supabase/functions/absence-create/index.ts');

    expect(source).toContain('supabase.auth.getUser(token)');
    expect(source).toContain('Only admin/responsible users can set origin=admin');
    expect(source).toContain('Employees can only create absences for themselves');
    expect(source).toContain('employee_id does not belong to provided company_id');
    expectGuardWithStatus(source, 'Missing Authorization header', 401);
    expectGuardWithStatus(source, 'Invalid Authorization token', 401);
    expectGuardWithStatus(source, 'Insufficient permissions', 403);
  });

  it('employee-credentials should contain auth, role and tenant 401/403 guards', () => {
    const source = readRepoFile('supabase/functions/employee-credentials/index.ts');

    expect(source).toContain('supabaseAdmin.auth.getUser(token)');
    expect(source).toContain('.from(\'user_roles\')');
    expect(source).toContain('Insufficient permissions');
    expect(source).toContain('User not assigned to requested company');
    expectGuardWithStatus(source, 'Missing Authorization header', 401);
    expectGuardWithStatus(source, 'Invalid Authorization token', 401);
    expectGuardWithStatus(source, 'Unauthorized user', 401);
    expectGuardWithStatus(source, 'Insufficient permissions', 403);
  });

  it.each(fixturesFunctions)(
    '%s should contain environment + super_admin restrictions with 401/403 guards',
    (functionName) => {
      const source = readRepoFile(`supabase/functions/${functionName}/index.ts`);

      expect(source).toContain('isFixtureEnvironmentAllowed');
      expect(source).toContain('ALLOW_TEST_FIXTURES');
      expect(source).toContain('.auth.getUser(token)');
      expect(source).toContain('Only super_admin can run');
      expectGuardWithStatus(source, 'Missing Authorization header', 401);
      expectGuardWithStatus(source, 'Invalid Authorization token', 401);
      expectGuardWithStatus(source, 'Only super_admin can run', 403);
    },
  );
});

const describeLive = runLiveEndpointChecks ? describe : describe.skip;

describeLive('Cycle 15: Security Regression (Lote 1) - live endpoint smoke', () => {
  it('should reject unauthenticated invoke for hardened public-risk functions (401/403)', async () => {
    const client = createAnonClient();
    if (!client) {
      throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY for live security checks');
    }

    const cases = [
      {
        name: 'generate-itss-package',
        body: {
          company_id: 'c0000000-0000-0000-0000-000000000001',
          period_start: '2026-01-01',
          period_end: '2026-01-31',
          components: {
            daily_record: true,
            labor_calendar: true,
            policies: true,
            contract_summary: true,
          },
          dry_run: true,
        },
      },
      {
        name: 'absence-create',
        body: {
          company_id: 'c0000000-0000-0000-0000-000000000001',
          employee_id: '00000000-0000-0000-0000-000000000001',
          absence_type_id: '00000000-0000-0000-0000-000000000001',
          start_date: '2026-02-01',
          end_date: '2026-02-01',
          reason: 'security regression test',
          origin: 'employee',
        },
      },
      {
        name: 'employee-credentials',
        body: { action: 'reset_password', user_id: '00000000-0000-0000-0000-000000000001', new_password: 'x' },
      },
      ...fixturesFunctions.map((name) => ({ name, body: {} })),
    ];

    for (const testCase of cases) {
      const { error } = await client.functions.invoke(testCase.name, { body: testCase.body });
      const status = getErrorStatus(error);
      expect(status, `${testCase.name} should reject unauthenticated invoke with 401/403`).toBeTruthy();
      expect([401, 403]).toContain(status as number);
    }
  }, 30_000);
});
