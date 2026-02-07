## 2026-01-12 - Missing Authorization in QTSP Notarize
**Vulnerability:** The `qtsp-notarize` edge function was publicly accessible and processed actions based on `company_id` without verifying the caller's identity or authorization.
**Learning:** Edge functions served via `serve` are public by default. Internal functions (like this one) must manually verify the `Authorization` header to distinguish between internal system calls (Service Key) and user calls (JWT).
**Prevention:** Implement a strict `verifyAuthorization` helper in all sensitive edge functions that checks for Service Role Key or validates user JWT against the requested resource (company).
