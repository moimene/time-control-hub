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
