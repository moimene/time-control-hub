## 2026-01-20 - Insecure Random Number Generation in Edge Functions
**Vulnerability:** Used `Math.random()` for password generation in Supabase Edge Functions.
**Learning:** Deno's `Math.random()` is not cryptographically secure. `crypto.getRandomValues()` is available and should be used for secrets.
**Prevention:** Use `crypto.getRandomValues()` for all secret generation.
