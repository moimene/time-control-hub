# Sentinel Journal 🛡️

## 2025-02-18 - Missing Authentication in Edge Functions
**Vulnerability:** Discovered multiple Supabase Edge Functions (`employee-credentials`, `qtsp-notarize`) that execute critical logic (user creation, digital notarization) without checking the `Authorization` header or validating the caller's identity.
**Learning:** Supabase Edge Functions are raw HTTP servers; simply using `SUPABASE_SERVICE_ROLE_KEY` inside the function does not automatically protect the endpoint. The `Authorization` header must be manually parsed and validated against `supabase.auth.getUser()`.
**Prevention:** All new Edge Functions must include a standard authentication block at the beginning that verifies the JWT and checks permissions before processing any logic.
