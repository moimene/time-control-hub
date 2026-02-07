## 2026-01-23 - Edge Function Public Exposure
**Vulnerability:** Supabase Edge Functions (`serve`) are public by default. Internal logic using `SUPABASE_SERVICE_ROLE_KEY` does not automatically protect the endpoint from external callers who can guess the URL and parameters (like `company_id`).
**Learning:** We must manually validate the `Authorization` header in every Edge Function. If it matches `SUPABASE_SERVICE_ROLE_KEY`, it's an internal trusted call. If it's a user JWT, we must validate it via `supabase.auth.getUser()` and check permissions.
**Prevention:** Always implement a `validateAuth` helper in Edge Functions that handles both Service Role (internal) and User JWT (external) authentication before processing any request.
