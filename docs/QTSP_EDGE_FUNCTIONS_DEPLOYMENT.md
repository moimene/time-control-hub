# QTSP Edge Functions Deployment (Supabase-First)

This repo is designed to be deployed and operated without Lovable. Edge Functions are deployed directly to your own Supabase project using the Supabase CLI.

## Prerequisites
- Supabase CLI installed
- Access to your Supabase project (Project Ref + appropriate permissions)

## 1) Link this repo to your Supabase project
```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
```

## 2) Configure Edge Function secrets (never commit)
Set secrets in Supabase (Dashboard: Project Settings -> Edge Functions -> Secrets) or via CLI:

```bash
supabase secrets set \\
  DIGITALTRUST_API_URL=\"<https://api.example.tld>\" \\
  DIGITALTRUST_LOGIN_URL=\"<https://auth.example.tld/oauth/token>\" \\
  DIGITALTRUST_CLIENT_ID=\"<client-id>\" \\
  DIGITALTRUST_CLIENT_SECRET=\"<client-secret>\" \\
  RESEND_API_KEY=\"<optional>\" \\
  RESEND_FROM_EMAIL=\"<optional: no-reply@yourdomain.tld>\"
```

Notes:
- Rotate any secrets that were ever committed to git history (assume compromised).
- If you use Resend, you must use a verified sending domain and set `RESEND_FROM_EMAIL`.
- Env var aliases: the code accepts `QTSP_*` as fallbacks for `DIGITALTRUST_*`:
  - `QTSP_API_BASE_URL` -> `DIGITALTRUST_API_URL`
  - `QTSP_OKTA_TOKEN_URL` -> `DIGITALTRUST_LOGIN_URL`
  - `QTSP_CLIENT_API` -> `DIGITALTRUST_CLIENT_ID`
  - `QTSP_CLIENT_SECRET` -> `DIGITALTRUST_CLIENT_SECRET`

## 3) Deploy Edge Functions
Deploy the QTSP function (and any others you need):

```bash
supabase functions deploy qtsp-notarize
```

If you changed function auth settings in `supabase/config.toml`, push config too:
```bash
supabase config push --yes
```

## 4) Verify the deployment
Call the function endpoint for your project:

```bash
curl -X POST \"https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/qtsp-notarize\" \\
  -H \"Content-Type: application/json\" \\
  -H \"Authorization: Bearer <JWT>\" \\
  -d '{\"action\":\"timestamp_daily\",\"daily_root_id\":\"<uuid>\",\"root_hash\":\"<hash>\",\"date\":\"2026-01-05\"}'
```

Where:
- `<JWT>` is a valid Supabase user JWT with the required permissions for the function.
- Even when `verify_jwt=false` is used for ES256 compatibility, functions still enforce auth and return 401/403 when called without a valid token.
