
import * as dotenv from 'dotenv';
dotenv.config();

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Validate required environment variables for integration tests
if (!process.env.VITE_SUPABASE_URL) {
    process.env.VITE_SUPABASE_URL = 'https://rsbwqgzespcltmufkhdx.supabase.co';
}
if (!process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'mock-key';
}

// Warn if service role key is missing (required for integration tests)
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not set. Integration tests requiring admin access will fail.');
}
