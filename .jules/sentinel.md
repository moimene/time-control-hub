## Sentinel Journal

## 2025-02-19 - Edge Function Authorization Gap
**Vulnerability:** Supabase Edge Functions using `serve` (like `qtsp-notarize`) were exposing public endpoints without validating the `Authorization` header. While they used a service role key internally to access the database, the entry point allowed any caller to invoke the function with arbitrary parameters (e.g., `company_id`) if they knew the URL.
**Learning:** Relying on `serve` bypasses Supabase's automatic Auth Layer (RLS) context propagation unless manually handled. Edge Functions acting as "admin" agents must manually verify the caller's identity (User JWT or Service Key) before performing privileged actions.
**Prevention:** Always implement an explicit `authorizeRequest` step at the beginning of `serve` handlers to validate `req.headers.get('Authorization')` against `SUPABASE_SERVICE_ROLE_KEY` or valid User JWTs with specific permission checks (e.g., `user_belongs_to_company`).
