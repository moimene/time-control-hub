# Verification Checklist

## How to use
- Execute checks in order.
- Record evidence file or command output for each check.
- Mark `PASS/FAIL/BLOCKED` with timestamp and reviewer.

## A. Security and Authorization

### A1. Edge function default auth hardening
- Scope: `F001`
- Check: No privileged mutating function is callable without validated identity.
- Steps:
1. Enumerate functions from `/tmp/time-control-hub/review/evidence/function_matrix.csv`.
2. Attempt unauthenticated calls to representative mutating endpoints.
3. Confirm HTTP `401/403` for unauthorized requests.
4. Run regression suite: `npx vitest run tests/cycle15_security_authz.test.ts`.
- Expected: Unauthorized callers cannot read/write tenant data.

### A2. ITSS export authorization
- Scope: `F002`
- Steps:
1. Invoke `generate-itss-package` without token.
2. Invoke with token from user not assigned to target company.
3. Invoke with valid authorized admin token.
- Expected:
1. No token: `401/403`.
2. Wrong tenant: `403`.
3. Authorized user: success and scoped data only.

### A3. Absence creation authorization
- Scope: `F003`
- Steps:
1. Invoke `absence-create` without token.
2. Invoke with employee token targeting a different employee/company.
3. Invoke with authorized admin/responsible token in same company.
- Expected:
1. Unauthorized blocked.
2. Cross-tenant/cross-user blocked.
3. Authorized within scope succeeds.

### A4. Test backdoor removal
- Scope: `F004`
- Steps:
1. Open `/test-credentials` in production-like build.
2. Invoke `setup-test-users`, `setup-test-data`, `seed-v1-fixtures`, `get-test-credentials` without privileged auth.
3. Validate source contract and config exceptions in `tests/cycle15_security_authz.test.ts`.
- Expected:
1. Route unavailable in production.
2. Test fixture endpoints blocked or unavailable.
3. Only `kiosk-clock` and `kiosk-auth` remain as `verify_jwt=false` exceptions.

### A5. Credential rotation and revocation
- Scope: `F004`, `F010`
- Steps:
1. Run inventory contract:
   `npx vitest run tests/cycle16_credential_rotation.test.ts`
2. Run active-login probe:
   `npm run security:probe-credentials`
3. Save probe output in:
   `/tmp/time-control-hub/review/evidence/credential_revocation_probe_latest.json`
4. Execute operational runbook:
   `/tmp/time-control-hub/review/credential-rotation-checklist.md`
- Expected:
1. Cycle 16 inventory test passes.
2. Probe exits `0` with no active exposed credentials.
3. Finding `F004` can be marked `closed` only when credential revocation probe reports zero active credentials and kiosk PIN revocation (A6) also reports `active_default_pins=0`.

### A6. Kiosk PIN revocation
- Scope: `F004`
- Steps:
1. Run safe default-PIN probe (no kiosk-clock side effects like creating `time_events`):
   `npm run security:probe-kiosk-default-pins`
   - Requires `SUPABASE_SERVICE_ROLE_KEY` (read-only hash comparison; no side effects).
2. Save probe output in:
   `/tmp/time-control-hub/review/evidence/kiosk_pin_default_revocation_probe_latest.json`
3. If `active_default_pins > 0`, rotate exposed kiosk PINs and salts:
   `npm run security:rotate-kiosk-pins`
4. Re-run the probe and confirm default PIN failures.
- Expected:
1. Post-rotation probe reports `active_default_pins=0`.
2. No known default PIN from seed/test artifacts authenticates in kiosk.

## B. Data Integrity and RLS

### B1. Corrections workflow audit integrity
- Scope: `F005`
- Steps:
1. Run correction request creation and approval flow (`tests/cycle6_corrections.test.ts` equivalent).
2. Inspect `audit_log` inserts.
- Expected:
1. No FK violation (`audit_log_actor_id_fkey`).
2. Audit entries preserve actor semantics and remain queryable.

### B2. RLS policy consistency across environments
- Scope: `F012`
- Steps:
1. Run static drift guard:
   `npm run security:audit-rls`
2. Run policy snapshot SQL (environment-aware, staging/prod):
   `/tmp/time-control-hub/scripts/security/policy-snapshot.sql`
3. Confirm no policies still use flipped argument order.
4. Validate effective policies for critical tables (`employees`, `time_events`, `correction_requests`, `audit_log`, `company`, `user_roles`).
- Expected: Policy catalog matches intended post-fix definitions.

## C. Test Harness Reliability

### C1. Secret handling consistency
- Scope: `F006`
- Steps:
1. Run `npm test` with `RUN_INTEGRATION_TESTS` unset/false (default).
2. Run `RUN_INTEGRATION_TESTS=true npm test` with explicit env profile + required variables.
3. (Admin suites) Provide `SUPABASE_SERVICE_ROLE_KEY` only in isolated environments; otherwise expect admin suites to skip with clear reason.
- Expected:
1. Unit/source-contract suites are green by default with integration disabled.
2. Integration suites do not run accidentally against shared remote environments.
3. Secret-dependent suites skip or fail-fast with clear messages (no crashes from non-null env assertions).

### C2. Offline test dependency integrity
- Scope: `F007`
- Steps:
1. Run `tests/cycle5_offline.test.ts` in isolation.
- Expected: No module-resolution failure for UUID generation.

### C3. ITSS test error semantics
- Scope: `F008`
- Steps:
1. Force ITSS function failure condition.
2. Run reporting test.
- Expected: Test fails with explicit backend error assertion, not null dereference.

## D. Dependency and Operations Controls

### D1. Dependency security baseline
- Scope: `F009`
- Steps:
1. Run `npm audit --json`.
2. Compare against accepted threshold.
- Expected: High-severity issues resolved (or explicitly risk-accepted with owner/date). CI baseline: `npm audit --audit-level=high` exits `0`.

### D2. Secret hygiene in repository
- Scope: `F010`
- Steps:
1. Verify `.env` is no longer tracked (`git ls-files .env`).
2. Confirm `.gitignore` contains `.env` rules.
3. Confirm `.env.example` exists with non-sensitive placeholders.
- Expected: Secret files are protected from accidental commits.

### D3. CI quality gates
- Scope: `F011`
- Steps:
1. Verify workflow files exist under `.github/workflows`.
2. Confirm CI runs test, build, audit, and lint (lint may be non-blocking until lint debt is remediated).
3. In GitHub branch settings, configure required checks for main branch.
- Expected: Main branch is protected by automated quality/security checks (and lint is flipped to blocking once debt is reduced).

## E. Code Quality and Performance

### E1. Lint debt reduction
- Scope: `F013`
- Steps:
1. Run `npm run lint`.
2. Compare error/warning counts against remediation target.
- Expected: Error count reduced to target threshold (ideally zero).

### E2. Bundle size optimization
- Scope: `F014`
- Steps:
1. Run `npm run build`.
2. Inspect generated chunk sizes.
- Expected: Main chunk reduced materially from 3,035.62 kB baseline and warning eliminated or approved.

## Sign-off Criteria
1. All P0 checks are `PASS`.
2. No open P1 findings without accepted mitigation and target date.
3. Remaining P2 items have scheduled owners and sprint commitments.
