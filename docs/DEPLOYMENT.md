# Deployment (Independent Stack)

This repository is designed to run without Lovable: the frontend is a Vite-built SPA and the backend is a Supabase project you own.

## Frontend (Vercel)
`vercel.json` is included to support client-side routing (`react-router-dom`) by rewriting unknown routes to `index.html`.

1. Create a Vercel project from this GitHub repo.
2. Configure build settings:
   - Install: `npm ci`
   - Build: `npm run build`
   - Output directory: `dist`
3. Set environment variables (Vercel Project Settings -> Environment Variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - Optional: `VITE_SUPABASE_PROJECT_ID`
   - Optional: `VITE_ENABLE_TEST_CREDENTIALS` must **not** be `"true"` in production.
   - Never set `SUPABASE_SERVICE_ROLE_KEY` in Vercel (service-role is backend-only).
4. Deploy and validate:
   - Hard refresh on deep routes like `/admin` and `/employee` (should not 404).
   - Login flow and role redirects.
   - Kiosk route `/kiosk` loads offline-capable PWA assets.

## Backend (Supabase)
Backend is managed via Supabase migrations and Edge Functions in this repo.

1. Link the CLI to your Supabase project:
```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
```

2. Apply DB migrations:
```bash
supabase db push
```

3. Deploy Edge Functions you use:
```bash
supabase functions deploy
```

If you don't have Docker available locally, you can deploy using the remote builder:
```bash
supabase functions deploy --use-api
```

4. Push edge config (auth gate defaults, per-function overrides):
```bash
supabase config push --yes
```

5. Configure Edge Function secrets (Dashboard or `supabase secrets set`):
   - QTSP: `DIGITALTRUST_*` (see `docs/QTSP_EDGE_FUNCTIONS_DEPLOYMENT.md`)
   - Email: `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (recommended)

## Edge Functions Auth Notes (ES256 + `verify_jwt`)

This project uses Supabase Auth access tokens signed with **ES256**. At the time of writing, Supabase Edge's
gateway-level `verify_jwt=true` does not accept ES256 user JWTs and will return `401 Invalid JWT`.

Current strategy:
- Any Edge Function invoked from the frontend must be configured with `verify_jwt=false` in `supabase/config.toml`.
- Each function performs **manual authentication/authorization** by:
  - Reading the `Authorization: Bearer <token>` header.
  - Resolving the user via `supabase.auth.getUser(token)` (service client).
  - Enforcing role + tenant scope before any read/write.
- Shared helper: `supabase/functions/_shared/auth.ts`.
- Regression suite: `tests/cycle15_security_authz.test.ts` (includes optional live 401/403 smoke when enabled).

## Cutover Checklist (from Lovable)
1. Ensure this GitHub repo is the only source of truth for frontend + backend artifacts.
2. Remove Lovable-only tooling/docs from the repo and rotate any secrets ever exposed in git history.
3. Deploy Supabase migrations/functions to the owned Supabase project and run smoke/security checks.
4. Deploy the frontend from GitHub (Vercel or equivalent) pointing at the owned Supabase project via env vars.
5. Disable the Lovable-hosted frontend and revoke any tokens/keys Lovable had access to.
