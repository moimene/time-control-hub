# Sentinel's Journal

## 2025-02-18 - Missing Authentication in Public Edge Functions
**Vulnerability:** The `qtsp-notarize` Edge Function was exposed publicly without any authentication check, allowing unauthorized users to perform sensitive operations (timestamping, PDF sealing) by providing a target `company_id`.
**Learning:** Supabase Edge Functions invoked via `serve` are public by default. Internal functions that are also called by other Edge Functions (like schedulers) must implement hybrid authentication: explicitly checking `SUPABASE_SERVICE_ROLE_KEY` for internal calls and validating User JWTs for frontend calls.
**Prevention:** Always implement an authentication block at the start of any Edge Function. Use a helper function or middleware pattern to enforce this check consistently across all functions. Ensure `Authorization` header is verified against both Service Key and User Session.
