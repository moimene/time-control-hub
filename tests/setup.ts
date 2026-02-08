import * as dotenv from 'dotenv';

const wantsIntegrationEnv =
  process.env.RUN_INTEGRATION_TESTS === 'true' ||
  process.env.RUN_REMOTE_SECURITY_REGRESSION === 'true' ||
  process.env.RUN_CREDENTIAL_REVOCATION_PROBE === 'true';

// Keep integration creds in `.env.integration` (gitignored). Load it first when
// running any integration/live security probes, and fill missing vars from `.env`.
if (wantsIntegrationEnv) {
  dotenv.config({ path: '.env.integration', override: false, quiet: true });
}
dotenv.config({ override: false, quiet: true });

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Integration tests must be explicitly enabled to avoid accidental writes to shared environments.
const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';

if (runIntegration) {
  const missing: string[] = [];
  if (!process.env.VITE_SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
  if (!process.env.VITE_SUPABASE_PUBLISHABLE_KEY) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');

  if (missing.length > 0) {
    throw new Error(`RUN_INTEGRATION_TESTS=true but missing: ${missing.join(', ')}`);
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not set. Admin integration tests will be skipped.');
  }
}
