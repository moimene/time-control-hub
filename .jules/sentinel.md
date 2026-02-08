## 2024-05-22 - Insecure Random Number Generation in Edge Functions
**Vulnerability:** Usage of `Math.random()` for generating temporary passwords in Supabase Edge Functions.
**Learning:** Supabase Edge Functions run in Deno, which supports the Web Crypto API. `Math.random()` is not cryptographically secure and should not be used for security-sensitive values like passwords or tokens.
**Prevention:** Always use `crypto.getRandomValues()` for generating random values intended for security contexts (passwords, tokens, nonces).
