# Security Policy

## Reporting a Vulnerability

1. Prefer GitHub Private Vulnerability Reporting (repo: **Security** -> **Report a vulnerability**) when available.
2. If private reporting is not enabled, contact the repository owner via GitHub and request a private channel before sharing details.

## Do Not Post Secrets

Do **not** paste any of the following into issues, pull requests, logs, or chat transcripts:
- Supabase `service_role` keys, JWTs, database passwords
- Resend API keys
- QTSP / Digital Trust client secrets or access tokens

Use `.env.example` as a template and store real secrets only in:
- Your local environment (untracked files like `.env.integration`)
- Supabase Edge Function Secrets (Dashboard / CLI `supabase secrets set`)
- Vercel Environment Variables (frontend-safe vars only)

## Supported Versions

Only the `main` branch is supported for security fixes.

