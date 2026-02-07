# Sentinel's Security Journal 🛡️

This journal tracks CRITICAL security learnings, vulnerabilities, and patterns discovered in the codebase.
It is NOT a log of every fix. Only document unique insights, architectural gaps, or reusable security patterns.

Format:
## YYYY-MM-DD - [Title]
**Vulnerability:** [What you found]
**Learning:** [Why it existed]
**Prevention:** [How to avoid next time]

---
## 2025-02-18 - Missing Tenancy Checks in Edge Functions
**Vulnerability:** `qtsp-notarize` edge function accepted any `company_id` without verifying if the user belongs to that company. It utilized the service role key for database operations, bypassing RLS.
**Learning:** Edge Functions running with `service_role` key must explicitly implement authorization and tenancy checks if they accept parameters like `company_id` from the client.
**Prevention:** Always validate the `Authorization` header. If it's a user token, verify tenancy against the `user_company` table before performing sensitive actions.
