import { describe, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const RUN_INTEGRATION_TESTS = process.env.RUN_INTEGRATION_TESTS === 'true';

// Note: Vitest may still evaluate suite bodies when using `describe.skip`.
// To avoid import-time failures, integration suites are defined only when explicitly enabled.
export function describeIntegration(name: string, fn: () => void): void {
  if (!RUN_INTEGRATION_TESTS) {
    describe(name, () => {
      it.skip('integration tests disabled (set RUN_INTEGRATION_TESTS=true to enable)', () => {});
    });
    return;
  }
  describe(name, fn);
}

export function describeServiceIntegration(name: string, fn: () => void): void {
  if (!RUN_INTEGRATION_TESTS) {
    describe(name, () => {
      it.skip('integration tests disabled (set RUN_INTEGRATION_TESTS=true to enable)', () => {});
    });
    return;
  }
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    describe(name, () => {
      it.skip('admin integration tests disabled (missing SUPABASE_SERVICE_ROLE_KEY)', () => {});
    });
    return;
  }
  describe(name, fn);
}

export function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function getAnonClient(): SupabaseClient {
  const url = requireEnvVar('VITE_SUPABASE_URL');
  const key = requireEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getServiceClient(): SupabaseClient {
  const url = requireEnvVar('VITE_SUPABASE_URL');
  const key = requireEnvVar('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type EmailPassword = { email: string; password: string };

export function getCredential(prefix: string): EmailPassword | null {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) return null;
  return { email, password };
}

export function requireCredential(prefix: string): EmailPassword {
  const cred = getCredential(prefix);
  if (!cred) {
    throw new Error(`Missing required credentials: ${prefix}_EMAIL and/or ${prefix}_PASSWORD`);
  }
  return cred;
}

export async function loginWithCredential(client: SupabaseClient, prefix: string): Promise<void> {
  const { email, password } = requireCredential(prefix);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Failed to login (${prefix}): ${error.message}`);
  }
}
