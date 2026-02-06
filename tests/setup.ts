
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

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
