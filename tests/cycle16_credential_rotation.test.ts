import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

type ExposedCredential = {
  label: string;
  email: string;
  password: string;
  source: string;
};

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const runLiveRevocationProbe = process.env.RUN_CREDENTIAL_REVOCATION_PROBE === 'true';

const EXPOSED_CREDENTIALS: ExposedCredential[] = [
  {
    label: 'super_admin_default',
    email: 'superadmin@timecontrol.com',
    password: 'super123',
    source: 'supabase/functions/setup-test-data/index.ts',
  },
  {
    label: 'admin_elrincon_default',
    email: 'admin@elrincon.com',
    password: 'bar123',
    source: 'supabase/functions/setup-test-data/index.ts',
  },
  {
    label: 'admin_zapateria_default',
    email: 'admin@zapateria-lopez.com',
    password: 'zap123',
    source: 'supabase/functions/setup-test-data/index.ts',
  },
  {
    label: 'admin_dental_default',
    email: 'admin@dentalsonrisas.com',
    password: 'den123',
    source: 'supabase/functions/setup-test-data/index.ts',
  },
  {
    label: 'admin_fisio_default',
    email: 'admin@fisio-wellness.com',
    password: 'fis123',
    source: 'supabase/functions/setup-test-data/index.ts',
  },
  {
    label: 'responsable_elrincon_default',
    email: 'responsable@elrincon.com',
    password: 'resp123',
    source: 'supabase/functions/setup-test-data/index.ts',
  },
  {
    label: 'responsable_zapateria_default',
    email: 'responsable@zapateria-lopez.com',
    password: 'resp123',
    source: 'src/pages/TestCredentials.tsx',
  },
  {
    label: 'responsable_dental_default',
    email: 'responsable@dentalsonrisas.com',
    password: 'resp123',
    source: 'src/pages/TestCredentials.tsx',
  },
  {
    label: 'responsable_fisio_default',
    email: 'responsable@fisio-wellness.com',
    password: 'resp123',
    source: 'src/pages/TestCredentials.tsx',
  },
  {
    label: 'responsable_test_default',
    email: 'responsable@test.com',
    password: 'resp123',
    source: 'supabase/functions/setup-test-users/index.ts',
  },
  {
    label: 'employee_elrincon_default',
    email: 'juan.martinez@elrincon.com',
    password: 'emp123',
    source: 'supabase/functions/setup-test-data/index.ts',
  },
  {
    label: 'employee_bar002_default',
    email: 'ana.lopez@elrincon.com',
    password: 'emp123',
    source: 'src/pages/TestCredentials.tsx',
  },
  {
    label: 'employee_zap001_default',
    email: 'lucia.moreno@zapateria-lopez.com',
    password: 'emp123',
    source: 'src/pages/TestCredentials.tsx',
  },
  {
    label: 'employee_zap002_default',
    email: 'roberto.navarro@zapateria-lopez.com',
    password: 'emp123',
    source: 'src/pages/TestCredentials.tsx',
  },
  {
    label: 'employee_den001_default',
    email: 'alberto.ruiz@dentalsonrisas.com',
    password: 'emp123',
    source: 'src/pages/TestCredentials.tsx',
  },
  {
    label: 'employee_den003_default',
    email: 'sofia.herrera@dentalsonrisas.com',
    password: 'emp123',
    source: 'src/pages/TestCredentials.tsx',
  },
  {
    label: 'employee_fis001_default',
    email: 'david.molina@fisio-wellness.com',
    password: 'emp123',
    source: 'src/pages/TestCredentials.tsx',
  },
  {
    label: 'employee_fis002_default',
    email: 'laura.gutierrez@fisio-wellness.com',
    password: 'emp123',
    source: 'src/pages/TestCredentials.tsx',
  },
  {
    label: 'fixture_admin_default',
    email: 'admin@test.com',
    password: 'admin123',
    source: 'supabase/functions/setup-test-users/index.ts',
  },
  {
    label: 'fixture_employee_default',
    email: 'carlos.garcia@empresa.com',
    password: 'emp123',
    source: 'supabase/functions/setup-test-users/index.ts',
  },
  {
    label: 'asesor_default',
    email: 'asesor@laboralconsulting.com',
    password: 'asesor123',
    source: 'supabase/functions/seed-v1-fixtures/index.ts',
  },
];

function isRateLimitError(message: string | null | undefined): boolean {
  return typeof message === 'string' && /rate limit/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Cycle 16: Credential Rotation/Revocation (Lote 1)', () => {
  it('should maintain a tracked inventory of exposed credentials to revoke', () => {
    expect(EXPOSED_CREDENTIALS.length).toBeGreaterThan(0);
    for (const credential of EXPOSED_CREDENTIALS) {
      expect(credential.email).toContain('@');
      expect(credential.password.length).toBeGreaterThanOrEqual(6);
      expect(credential.source).toContain('/');
    }
  });
});

const describeLiveProbe = runLiveRevocationProbe ? describe : describe.skip;

describeLiveProbe('Cycle 16: Live revocation probe', () => {
  it('all known exposed credentials should be revoked (no successful sign-in)', async () => {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY for credential revocation probe',
      );
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const activeCredentials: Array<{ label: string; email: string }> = [];
    const indeterminateCredentials: Array<{ label: string; email: string; reason: string }> = [];

    for (const credential of EXPOSED_CREDENTIALS) {
      let loginSucceeded = false;
      let lastErrorMessage = 'Unknown authentication error';

      for (let attempt = 1; attempt <= 4; attempt += 1) {
        const { data, error } = await client.auth.signInWithPassword({
          email: credential.email,
          password: credential.password,
        });

        loginSucceeded = Boolean(data?.session) && !error;
        if (loginSucceeded) {
          lastErrorMessage = '';
          break;
        }

        lastErrorMessage = error?.message || 'Unknown authentication error';
        if (!isRateLimitError(lastErrorMessage)) {
          break;
        }

        if (attempt < 4) {
          await sleep(1200 * attempt);
        }
      }

      if (loginSucceeded) {
        activeCredentials.push({ label: credential.label, email: credential.email });
        await client.auth.signOut();
      } else if (isRateLimitError(lastErrorMessage)) {
        indeterminateCredentials.push({
          label: credential.label,
          email: credential.email,
          reason: lastErrorMessage,
        });
      }
    }

    expect(indeterminateCredentials).toEqual([]);
    expect(activeCredentials).toEqual([]);
  }, 60_000);
});
