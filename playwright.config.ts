import fs from 'node:fs';
import * as dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

// Load local integration secrets when available (file is gitignored).
// CI should inject env vars instead.
const envFile = process.env.E2E_ENV_FILE ?? '.env.integration';
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile, override: false, quiet: true });
} else {
  dotenv.config({ override: false, quiet: true });
}

const baseURL =
  process.env.E2E_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  'https://time-control-hub.vercel.app';

const configuredWorkers = Number(process.env.E2E_WORKERS);
const workers = Number.isFinite(configuredWorkers) && configuredWorkers > 0 ? configuredWorkers : 2;

export default defineConfig({
  testDir: './e2e',
  testMatch: /\.e2e\.ts/,
  timeout: 60_000,
  expect: { timeout: 15_000 },

  fullyParallel: true,
  workers,
  retries: process.env.CI ? 2 : 1,

  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
