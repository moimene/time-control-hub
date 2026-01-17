## 2024-05-22 - Supabase Edge Functions Secure Randomness
**Vulnerability:** Used `Math.random()` for password generation in `admin-password-reset` function.
**Learning:** Supabase Edge Functions run in Deno where `Math.random()` is not cryptographically secure, and `crypto` global is available.
**Prevention:** Always use `crypto.getRandomValues()` for secrets, tokens, and passwords in Edge Functions.
