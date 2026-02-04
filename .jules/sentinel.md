## 2025-02-12 - Supabase Edge Function Authorization Gap
**Vulnerability:** `employee-credentials` Edge Function exposed administrative actions (create user, reset password) without any authentication or authorization checks, allowing arbitrary account takeover.
**Learning:** Supabase Edge Functions using `Deno.serve` are public HTTP endpoints. Creating a Supabase client with `SUPABASE_SERVICE_ROLE_KEY` inside the function does not automatically protect the endpoint.
**Prevention:** Always implement explicit JWT verification (`supabase.auth.getUser(token)`), RBAC checks (query `user_roles`), and tenancy checks (query `user_company`) at the start of any privileged Edge Function.
