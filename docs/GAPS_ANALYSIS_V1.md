# GAPS_ANALYSIS_V1 — Updated (2026-02-08)

This document tracks gaps against `docs/TEST_PLAN_V1.md` and the current repository state.

## Current State (What Is Already Implemented)

### 1. RLS & Multi-tenancy (Cycle 1)
- RLS helper argument-order issues were addressed via migrations and are guarded by:
  - Static check: `npm run security:audit-rls`
  - Optional live audit: `npm run security:audit-rls-live`
- Role `asesor` exists in `app_role`, with read-only RLS policies and UI routes under `/asesor`.

### 2. Fixtures / Seed (Cycles 2–3)
- `supabase/functions/seed-v1-fixtures` exists and seeds the 3-company dataset (including Atlantic/Canary TZ), holidays and base rules.
- Seed/fixture functions are gated (environment + `super_admin`), and the UI route `/test-credentials` is disabled by default in production builds.

### 3. Kiosk Flow (Cycle 4)
- Playwright E2E includes a kiosk flow test (`e2e/kiosk.e2e.ts`) covering terminal activation + PIN clock in/out.
- Default kiosk PIN exposure is probed/rotated via scripts under `scripts/security/`.

### 4. Compliance Engine (Cycle 8/9)
- `supabase/functions/compliance-evaluator` fetches effective rules from DB (`rule_assignments` + `rule_versions`) with fallbacks.
- Admin UI for compliance exists under `/admin/compliance` and incidents under `/admin/compliance/incidents`.

### 5. Edge Functions Auth (P0 operational reality)
- Supabase Auth access tokens in this project are **ES256**.
- Supabase Edge gateway `verify_jwt=true` can reject ES256 user JWTs; frontend-invoked Edge Functions are configured with `verify_jwt=false` and enforce manual auth/role/tenant checks inside each function.
- Regression suite: `tests/cycle15_security_authz.test.ts` (with optional live smoke).

## Remaining Gaps / Risks (What Still Needs Work)

### 1. E2E breadth (Cycle 0 across all roles)
- We now have navigation coverage for admin/responsible/employee and optional super-admin/asesor, but deeper workflow E2E tests are still limited.
- Recommended next E2E workflows to add (incrementally):
  - Employee absence request -> responsible/admin approval
  - Employee correction request -> approval workflow + audit presence
  - Admin communications -> employee response thread
  - ITSS generator dry-run -> expected outputs render/download

### 2. Offline PWA regression (Cycle 5)
- No automated browser-level offline capture/sync/idempotency scenario yet (should be Playwright with offline mode + IndexedDB assertions).

### 3. CI execution of E2E
- GitHub Actions currently runs unit/source-contract tests and build/lint/audit.
- Add an E2E job only on a dedicated test/staging environment with injected `TEST_*` vars (avoid running E2E against shared/prod unintentionally).

### 4. Test-only code shipping
- `/test-credentials` is inaccessible by default, but the page module still exists in the codebase.
- For stronger sanitization, consider stripping the test-credentials module from production builds entirely (build-time gating + dead-code elimination).

## References
- Test plan: `docs/TEST_PLAN_V1.md`
- Verification: `docs/VERIFICATION_PLAN_V1.md`
- E2E guide: `docs/E2E.md`

