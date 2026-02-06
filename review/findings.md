# Review Findings — time-control-hub

## Context
- Repository: `/tmp/time-control-hub`
- Commit reviewed: `b786f6b` (`/tmp/time-control-hub/review/evidence/commit.txt`)
- Review timestamp (UTC): `/tmp/time-control-hub/review/evidence/review_timestamp.txt`
- Toolchain: `/tmp/time-control-hub/review/evidence/toolchain.txt`

## Baseline Execution
Commands were executed on the pinned commit and captured in `/tmp/time-control-hub/review/evidence`.

| Command | Exit code | Evidence |
|---|---:|---|
| `npm ci` | 0 | `/tmp/time-control-hub/review/evidence/npm_ci.txt` |
| `npm run lint` | 1 | `/tmp/time-control-hub/review/evidence/npm_lint.txt` |
| `npm test` | 1 | `/tmp/time-control-hub/review/evidence/npm_test.txt` |
| `npm run build` | 0 | `/tmp/time-control-hub/review/evidence/npm_build.txt` |
| `npm audit --json` | 1 | `/tmp/time-control-hub/review/evidence/npm_audit.json` |

## Bucket Classification
- Security: `F001`, `F002`, `F003`, `F004`, `F009`
- Functional: `F005`
- Test harness: `F006`, `F007`, `F008`
- Code quality/operations/performance: `F010`, `F011`, `F012`, `F013`, `F014`

## Key Baseline Signals
- Lint debt: 283 findings (266 errors, 17 warnings). Dominant rule: `@typescript-eslint/no-explicit-any` (242 occurrences). See `/tmp/time-control-hub/review/evidence/lint_rule_counts.csv` and `/tmp/time-control-hub/review/evidence/lint_top_files.csv`.
- Test status: 7 failed files, 3 failed tests, 12 warnings for missing `SUPABASE_SERVICE_ROLE_KEY`. See `/tmp/time-control-hub/review/evidence/test_failure_summary.txt`.
- Dependency risk: 10 vulnerabilities (6 high, 4 moderate), all fixable. See `/tmp/time-control-hub/review/evidence/npm_audit_summary.csv`.
- Build signal: production build passes, but main chunk is ~3.0 MB with chunk-size warning. See `/tmp/time-control-hub/review/evidence/npm_build.txt`.

## Lote 1 Closure Status (Auth Surface)
- `supabase/config.toml` now enforces `verify_jwt=true` for all edge functions except `kiosk-auth` + `kiosk-clock` (explicit exceptions).
- High-risk mutators now reject unauthorized callers with explicit 401/403:
  - `generate-itss-package`: requires JWT, privileged role, and company assignment.
  - `absence-create`: requires JWT, role checks, tenant scope validation, and self-only constraints for employees.
- Test/fixture functions are gated behind `ALLOW_TEST_FIXTURES` and `super_admin`.
- Regression evidence:
  - `/tmp/time-control-hub/review/evidence/security_regression_2026-02-06T190117Z.txt` (`exit=0`)
- Deployment note: these controls must be deployed to the target Supabase environment(s) to eliminate the live exposure.

## Production Snapshot (Supabase `ouxzjfqqgxlvxhjyihum`, Feb 6 2026)
- Edge functions deployed (subset): `generate-itss-package`, `absence-create`, `employee-credentials`, `setup-test-users`, `setup-test-data`, `seed-v1-fixtures`, `get-test-credentials`.
- Live 401/403 regression suite (remote checks enabled):
  - `/tmp/time-control-hub/review/evidence/security_regression_prod_20260206T203553Z.txt` (`exit=0`)
- Credential revocation probe against production:
  - `/tmp/time-control-hub/review/evidence/credential_revocation_probe_prod_20260206T203602Z.json` shows `active=0`, `indeterminate=0`.
- Database migrations applied to production (schema now present):
  - Final migration state: `/tmp/time-control-hub/review/evidence/prod_migration_list_post_20260206T211648Z.txt` (all local migrations applied remotely).
  - Push logs: `/tmp/time-control-hub/review/evidence/prod_db_push_apply_retry2_20260206T211640Z.txt`.
- Kiosk default PIN probe against production (post-migrations):
  - `/tmp/time-control-hub/review/evidence/kiosk_pin_default_revocation_probe_prod_20260206T211716Z.json` shows `active_default_pins=0`, `errored=0`, `missing=21` (no seeded employees present yet).

## Lote 1 Closure Status (Credentials)
- Credential rotation/revocation executed (21 accounts) with global sign-out evidence:
  - `/tmp/time-control-hub/review/evidence/credential_rotation_run_2026-02-06.json`
  - `/tmp/time-control-hub/review/evidence/credential_rotation_run_extra_2026-02-06.json`
- Revocation probe confirms old credentials cannot authenticate:
  - `/tmp/time-control-hub/review/evidence/credential_revocation_probe_latest.json` shows `active=0`, `indeterminate=0` at `2026-02-06T18:59:32.301Z`
  - Snapshot: `/tmp/time-control-hub/review/evidence/credential_revocation_probe_2026-02-06T190117Z.json`
- Historical baseline before kiosk PIN rotation:
  - `/tmp/time-control-hub/review/evidence/kiosk_pin_default_probe_after_password_rotation.json` showed `9/9` default PINs still authenticate.
- Kiosk default PIN exposure mitigated by rotating `employees.pin_hash/pin_salt` (21 employees):
  - `/tmp/time-control-hub/review/evidence/kiosk_pin_rotation_run_2026-02-06.json` shows `rotated=21/21`
  - `/tmp/time-control-hub/review/evidence/kiosk_pin_default_revocation_probe_latest.json` shows `active_default_pins=0` at `2026-02-06T18:59:36.428Z`
  - Snapshot: `/tmp/time-control-hub/review/evidence/kiosk_pin_default_revocation_probe_2026-02-06T190117Z.json`
- Credential/PIN closure state: **F004 closed**.

## Security and Authorization Matrix (Edge Functions)
Note: counts below reflect the baseline snapshot captured in `/tmp/time-control-hub/review/evidence/function_matrix.csv` before Lote 1 containment changes were applied in the repo.
- Total edge functions: 57 (`/tmp/time-control-hub/review/evidence/function_matrix.csv`)
- `verify_jwt=false`: 55/57
- Mutating functions: 47
- Mutating + `verify_jwt=false`: 46
- Mutating + `verify_jwt=false` + no token validation (`auth.getUser`): 36
- Public seed/test-related functions (`verify_jwt=false`): 4 (`setup-test-users`, `setup-test-data`, `seed-v1-fixtures`, `get-test-credentials`)

This creates a large unauthenticated attack surface where service-role code paths are exposed by default.

## Prioritized Findings (P0 → P2)

### P0
1. `F001` — Massive unauthenticated privileged function surface. (Closed in repo; deploy required.)
2. `F002` — ITSS export endpoint callable without authentication and scoped authorization. (Closed in repo; deploy required.)
3. `F003` — Absence creation endpoint accepts arbitrary tenant identifiers without caller validation. (Closed in repo; deploy required.)
4. `F004` — Public test credential route + exposed fixture/admin endpoints create credential and account takeover risk. (Closed.)

### P1
1. `F005` — Corrections workflow issues: audit trigger FK mismatch and missing `company_id` scoping blocked approvals. (Fixed via migrations; deploy required outside verified env.)
2. `F006` — Non-hermetic integration tests default to shared remote Supabase and fail inconsistently on missing secrets. (Closed.)
3. `F007` — Offline cycle test broken by missing `uuid` dependency. (Closed.)
4. `F008` — ITSS test masks backend failures with null dereference. (Closed.)
5. `F009` — High-severity dependency advisories in runtime/toolchain dependencies. (Closed; moderate Vite/esbuild remains.)
6. `F010` — `.env` tracked and ignore policy does not prevent future secret commits. (Closed.)
7. `F011` — No CI workflows enforcing quality/security gates. (Closed; lint non-blocking until debt remediated.)
8. `F012` — Historical RLS argument-order bug fixed later, but remains a migration drift risk across environments. (Mitigated with static guard; environment validation pending.)

### P2
1. `F013` — Lint debt concentrated in shared hooks/pages and edge functions.
2. `F014` — Oversized frontend chunk indicates route/code-splitting gaps.

## Data/RLS Risk Matrix by Critical Table

| Table | Risk | Notes |
|---|---|---|
| `employees` | High | Exposed mutating endpoints and test fixtures can alter records without strong caller checks (`F001`, `F004`). |
| `time_events` | High | Publicly callable service-role workflows plus reporting exports increase tampering/exfiltration risk (`F001`, `F002`). |
| `correction_requests` | High | Workflow previously blocked by audit FK + scoping issues; fixed via migrations (`F005`). |
| `audit_log` | High | Trigger actor mapping issue fixed via migration (`F005`). |
| `user_roles` | High | Public test/setup functions manipulate roles and auth users (`F004`). |
| `company` | High | Company-scoped operations are exposed through multiple service-role endpoints with weak request trust (`F001`, `F004`). |
| QTSP evidence tables | Medium/High | Export/health/retry endpoints publicly reachable when `verify_jwt=false`; strong auth boundaries missing (`F001`, `F002`). |

## Pending Environment Validations (Out of Scope for Local-Only Access)
- Confirm effective RLS policies in each deployed environment via live catalog queries.
- Validate whether any public function endpoints are already blocked by gateway/network controls external to repository config.
- Validate whether test routes/functions are disabled in production deployment build profiles.
