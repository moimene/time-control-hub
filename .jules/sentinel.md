## 2026-01-28 - Insecure Random Number Generation in Edge Functions
**Vulnerability:** Usage of `Math.random()` for generating passwords in Supabase Edge Functions (`admin-password-reset`, `company-provision`).
**Learning:** `Math.random()` is not cryptographically secure and predictable. Supabase Edge Functions (Deno) support the Web Crypto API globally.
**Prevention:** Use `crypto.getRandomValues(new Uint32Array(length))` to generate random values for secrets, then map them to the desired character set.
