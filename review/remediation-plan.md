# Remediation Plan — P0/P1/P2

## Objective
Eliminate critical exposure first (`P0`), recover functional reliability and governance second (`P1`), and then reduce structural debt/performance risk (`P2`).

## Execution Order
1. Lote 1 (P0): containment and access control hardening.
2. Lote 2 (P1): workflow correctness, test stability, dependency and operational controls.
3. Lote 3 (P2): maintainability and performance optimization.

## Lote 1 — P0 (Immediate Containment)
Target findings: `F001`, `F002`, `F003`, `F004`

> Nota ES256: este proyecto emite access tokens ES256 y Supabase Edge `verify_jwt=true` puede rechazar esos JWTs con `401 Invalid JWT`. Por tanto, las funciones invocadas desde frontend deben usar `verify_jwt=false` + auth manual en servidor (ver `tests/cycle15_security_authz.test.ts`).

### Work items
1. Gestionar `verify_jwt` por función en `/tmp/time-control-hub/supabase/config.toml`:
   - Mantener `verify_jwt=true` para funciones internas/cron cuando sea viable.
   - Establecer `verify_jwt=false` para funciones invocadas por el frontend (compatibilidad ES256) y exigir auth manual.
2. Mantener la lista aprobada de funciones con `verify_jwt=false` como contrato versionado y cubierto por tests (`tests/cycle15_security_authz.test.ts`).
3. Add mandatory server-side checks in privileged functions:
- Read `Authorization` header.
- Resolve user via `supabase.auth.getUser(token)`.
- Enforce role (`super_admin/admin/responsible/employee` as needed).
- Enforce tenant scope (`company_id` ownership) before any read/write.
4. Harden `generate-itss-package` and `absence-create` first as high-impact examples.
5. Disable or remove test-only surfaces from production paths:
- Remove unauthenticated `/test-credentials` route from production build.
- Restrict `setup-test-users`, `setup-test-data`, `seed-v1-fixtures`, `get-test-credentials` to non-production environments and privileged callers only.
6. Rotate any known static or test credentials already published in UI/code and invalidate compromised accounts.
7. Add credential revocation verification artifacts:
- `tests/cycle16_credential_rotation.test.ts` (inventory + optional live probe gate).
- `scripts/security/probe-credential-revocation.mjs` (`npm run security:probe-credentials`).
- Operational runbook at `/tmp/time-control-hub/review/credential-rotation-checklist.md`.

### Approved `verify_jwt=false` list (Lote 1)
The canonical list is enforced by `tests/cycle15_security_authz.test.ts` against `supabase/config.toml`.

Rationale: ES256 gateway incompatibility + mandatory in-function auth controls.

### Dependencies
- None. This lote is independent and blocking for all subsequent remediation.

### Acceptance criteria
1. No mutating function remains publicly callable without validated identity and authorization.
2. `verify_jwt=false` functions are restricted to frontend-invoked flows, documented, and enforced by regression tests.
3. `/test-credentials` is inaccessible in production.
4. Security regression tests for unauthorized calls pass (403/401 expected).
5. Credential revocation probe reports zero active exposed credentials.
6. Kiosk default PIN probe reports `active_default_pins=0` after rotation.

## Lote 2 — P1 (Correctness + Governance)
Target findings: `F005`, `F006`, `F007`, `F008`, `F009`, `F010`, `F011`, `F012`

### Work items
1. Fix audit trigger integrity:
- Update correction/audit trigger logic so `audit_log.actor_id` always maps to `auth.users.id` or becomes nullable with a distinct `employee_actor_id` field.
- Add migration for backfill/compatibility.
- Re-run correction workflow tests.
2. Stabilize test harness:
- Remove implicit fallback to shared remote URL in tests.
- Introduce explicit `TEST_ENV=local|staging` gating.
- Make service-key-dependent suites consistently `skip` with explicit reason when secrets are missing.
3. Fix broken tests:
- Replace `uuid` dependency with `crypto.randomUUID()` or add `uuid` package.
- Guard ITSS test assertions by checking `error` before dereferencing `result`.
4. Dependency remediation:
- Upgrade direct vulnerable dependencies (`jspdf`, `react-router-dom`, `vite`) and regenerate lockfile.
- Re-run audit and document remaining transitive advisories.
5. Secrets and repo hygiene:
- Stop tracking `.env`.
- Add `.env`, `.env.*` to `.gitignore` with explicit allowlist (`.env.example`).
6. Introduce CI quality gates:
- Add workflow for `npm ci`, `npm run lint`, `npm test`, `npm run build`, and dependency audit.
- Configure required checks on main branch.
7. Migration drift control:
- Add SQL policy-audit script that validates effective RLS definitions and expected function signatures in each environment.

### Dependencies
- Lote 1 must be complete to avoid validating against insecure endpoints.

### Acceptance criteria
1. `cycle6_corrections` passes without FK violations.
2. Test suite behavior is deterministic with clear skip/fail rules by environment.
3. Dependency audit reduced to accepted baseline with documented exceptions.
4. `.env` no longer tracked; CI blocks regressions.
5. Migration verification script reports no policy drift in target environment(s).

## Lote 3 — P2 (Debt + Performance)
Target findings: `F013`, `F014`

### Work items
1. Lint debt reduction in phases:
- Phase A: shared hooks (`useFullscreen`, `useKioskSession`) and top-offender edge functions.
- Phase B: admin/reporting pages.
- Phase C: cleanup of lower-frequency rules and warnings.
2. Type-hardening policy:
- Replace `any` with explicit domain types in high-churn files.
- Add lint budget threshold per sprint.
3. Bundle optimization:
- Add route-level dynamic imports for heavy screens (ITSS/reporting/PDF).
- Define manual chunking strategy in Vite config.
- Re-measure bundle output and first-load metrics.

### Dependencies
- Prefer completion of Lote 2 first, but can start in parallel once Lote 1 is closed.

### Acceptance criteria
1. Lint errors reduced to agreed threshold (target: zero errors, warnings budgeted).
2. Main chunk substantially reduced from current ~3.0 MB baseline.
3. Build output no longer emits large-chunk warning (or warning justified/documented with approved exception).

## Ownership Model
- Security/Backend: Lote 1 controls and endpoint auth.
- Data/Backend: trigger/RLS migration correctness.
- QA/Platform: test harness and CI gates.
- Frontend: route hardening and bundle optimization.

## Rollout and Risk Controls
1. Deploy Lote 1 behind emergency security release branch and verify endpoint lockdown before merging new feature work.
2. Run smoke tests after each lote; do not batch all lots into one release.
3. Keep rollback scripts for migration/trigger changes in Lote 2.
4. Track closure in `findings.json` by updating `status` field and adding closure evidence links.
