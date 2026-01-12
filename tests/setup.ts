
import * as dotenv from 'dotenv';
dotenv.config();

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Supabase environment variables if needed
if (!process.env.VITE_SUPABASE_URL) {
    process.env.VITE_SUPABASE_URL = 'https://mock.supabase.co';
}
if (!process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'mock-key';
}
