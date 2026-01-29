## 2024-05-22 - Hardcoded Secrets in Deployment Docs
**Vulnerability:** Found critical API keys and secrets hardcoded in `LOVABLE_DEPLOY_QTSP.md`.
**Learning:** Deployment documentation often becomes a source of leaks when developers paste real values for convenience or "quick start".
**Prevention:** Use placeholders (e.g., `<your-secret>`) in documentation. Scan markdown files for high-entropy strings or known key patterns.

## 2024-05-22 - Unauthenticated Edge Function
**Vulnerability:** `qtsp-notarize` Edge Function was publicly accessible via `serve` without validating the `Authorization` header, relying solely on `company_id` in the body.
**Learning:** Supabase Edge Functions using `serve` do not enforce RLS or Auth by default; developers must manually verify headers.
**Prevention:** Always implement an explicit authentication check at the beginning of any Edge Function handler, validating the JWT against `SUPABASE_ANON_KEY` or ensuring it matches `SUPABASE_SERVICE_ROLE_KEY`.
