# E2E (Playwright)

This repo includes browser-level end-to-end tests powered by Playwright under `e2e/`.

## 1) Install browsers (first time only)

```bash
npm run e2e:install
```

## 2) Provide test credentials

The E2E suite expects environment variables (never commit them). For local runs, the recommended path is:

1. Ensure these are present in your shell environment:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (only needed to seed)
2. Seed and generate a local `.env.integration` file (gitignored):

```bash
node scripts/setup/seed-integration-env.mjs
```

This creates/updates test users, a company, an active kiosk terminal, and writes the required `TEST_*` vars to `.env.integration` with file permissions `0600`.

> Note: `.env.integration` may contain values with spaces (for example `TEST_COMPANY_NAME=Bar El Rincón`), so it is **not** safe to `source` in a shell. Playwright loads it automatically. For Node/Vitest scripts, use dotenv loading (see below).

### If kiosk tests are being skipped

If you already have `.env.integration` (with `TEST_ADMIN_*` credentials) but the kiosk tests are skipped due to missing `TEST_KIOSK_*` vars, you can bootstrap just the kiosk prerequisites without using a service role key:

```bash
npm run setup:kiosk-e2e
```

This will:
- Ensure the company `employee_code_prefix` matches the `TEST_EMPLOYEE_CODE` convention.
- Create (or reuse) one `active` terminal.
- Set a valid 4-digit PIN for the test employee.
- Update `.env.integration` with the required `TEST_KIOSK_*` vars.

## 3) Run E2E against Vercel (default)

By default, `playwright.config.ts` uses `E2E_BASE_URL` if provided, otherwise it falls back to:
`https://time-control-hub.vercel.app`.

```bash
npm run e2e
```

## 4) Run E2E against a local build (optional)

In one terminal:

```bash
npm run dev
```

In another terminal:

```bash
E2E_BASE_URL=http://localhost:5173 npm run e2e
```

## Loading `.env.integration` for security regression / probes (optional)

Some security regression checks and probe scripts read `VITE_SUPABASE_*` at runtime. You can:
- Run Vitest live security checks by enabling flags (Vitest will load `.env.integration` automatically when these are set):
```bash
RUN_REMOTE_SECURITY_REGRESSION=true npm test
RUN_CREDENTIAL_REVOCATION_PROBE=true npm test
```
- Run the credential revocation probe script (it auto-loads `.env.integration` when present):
```bash
npm run security:probe-credentials
```

## Required environment variables

These are loaded from the current environment and, when present, from `.env.integration`:

- `TEST_ADMIN_EMAIL`
- `TEST_ADMIN_PASSWORD`
- `TEST_RESPONSIBLE_EMAIL`
- `TEST_RESPONSIBLE_PASSWORD`
- `TEST_EMPLOYEE_EMAIL`
- `TEST_EMPLOYEE_PASSWORD`
- `TEST_KIOSK_TERMINAL_NAME`
- `TEST_KIOSK_EMPLOYEE_CODE`
- `TEST_KIOSK_PIN`
