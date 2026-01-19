## 2025-05-20 - Missing Authentication in Supabase Edge Functions
**Vulnerability:** Several Supabase Edge Functions (e.g., `qtsp-notarize`, `absence-approve`) were publicly exposed via `serve` and trusted request bodies without verifying the caller's identity or authorization. They created an admin Supabase client using `SUPABASE_SERVICE_ROLE_KEY` to perform operations, effectively bypassing RLS for any caller who knew the endpoint URL and valid IDs.
**Learning:** Edge Functions using `serve` are public web endpoints. The `Authorization` header passed by `supabase.functions.invoke` must be manually verified. Simply checking for `company_id` or `user_id` in the body is insufficient. Even internal functions called by schedulers need to verify the `SUPABASE_SERVICE_ROLE_KEY` or a shared secret to prevent external abuse.
**Prevention:** Always implement an authentication check at the start of any Edge Function.
1. Extract `Authorization` header.
2. If internal, verify it matches the expected service key.
3. If user-facing, use it to create a scoped `supabaseClient` and verify `auth.getUser()`.
4. Check specific permissions (e.g., company membership) before performing sensitive actions.
