## 2025-05-23 - Supabase Edge Functions Authentication Bypass
**Vulnerability:** Edge Functions were verifying `company_id` parameter existence but not verifying the caller's authorization to access that company's data.
**Learning:** Supabase Edge Functions (`serve`) are public endpoints. Even with "Verify JWT" on, the function code receives the request and must explicitly validate that the authenticated user has permission for the requested resource (Broken Access Control / IDOR).
**Prevention:** Always implement a middleware-like check at the start of Edge Functions:
1. Extract `Authorization` header.
2. If matches `SERVICE_ROLE_KEY`, allow (internal call).
3. If not, validate JWT via `supabase.auth.getUser()`.
4. Validate resource ownership (e.g., `user_belongs_to_company` RPC).
