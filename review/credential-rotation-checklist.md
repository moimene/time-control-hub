# Lote 1 — Credential Rotation/Revocation Checklist (Operational)

## Scope
- Incident window baseline: **February 6, 2026**.
- Target: any account/password pair exposed in seed/test routes, test pages, fixtures, or review artifacts.
- Goal: no known exposed credential can authenticate, and all prior sessions are invalidated.

## Inputs
1. Exposed credential inventory from:
- `/tmp/time-control-hub/tests/cycle16_credential_rotation.test.ts`
- `/tmp/time-control-hub/scripts/security/probe-credential-revocation.mjs`
2. Security containment status from:
- `/tmp/time-control-hub/tests/cycle15_security_authz.test.ts`

## Operational Steps

### 1. Freeze non-essential auth changes
1. Pause fixture/seed execution in shared environments (`ALLOW_TEST_FIXTURES` disabled unless emergency).
2. Announce a password-rotation maintenance window to affected operators.

### 2. Build authoritative account list
1. Export all users from Supabase Auth dashboard.
2. Filter users matching exposed inventory emails (from Cycle 16).
3. Mark account class: `super_admin`, `admin`, `responsible`, `employee`, `asesor`, `test`.

### 3. Rotate credentials
1. For each matched account, set a new random password (minimum 20 chars, unique per user).
2. For employee kiosk users, rotate PIN credentials and salts where applicable.
3. Disable/delete non-required fixture accounts (`admin@test.com`, `carlos.garcia@empresa.com`, etc.) in non-test envs.

### 4. Revoke active sessions/tokens
1. Force logout for each rotated account from Supabase Auth admin controls.
2. If per-user revocation is not available in current tooling, apply global token/session invalidation according to platform runbook.

### 5. Verify revocation (mandatory)
1. Run probe:
```bash
cd /tmp/time-control-hub
npm run security:probe-credentials
```
2. Persist evidence:
- Output report path (default): `/tmp/time-control-hub/review/evidence/credential_revocation_probe_latest.json`
3. Expected result:
- Exit code `0`
- `active_credentials: []`

### 5.b Verify kiosk PIN revocation (mandatory for full F004 closure)
1. Run safe default-PIN probe (no `kiosk-clock` side effects like creating `time_events`):
```bash
cd /tmp/time-control-hub
# Requires service role access to read employees PIN hashes without side effects.
# Set SUPABASE_SERVICE_ROLE_KEY in your shell or .env (never commit).
npm run security:probe-kiosk-default-pins
```
2. Persist evidence:
- Output report path (default): `/tmp/time-control-hub/review/evidence/kiosk_pin_default_revocation_probe_latest.json`
3. If `active_default_pins > 0`, rotate exposed kiosk PINs and salts and re-run the probe:
```bash
cd /tmp/time-control-hub
npm run security:rotate-kiosk-pins
npm run security:probe-kiosk-default-pins
```
4. Expected:
- `active_default_pins = 0`
- No default PIN from seed/test UI works in kiosk.

### 6. Verify security guardrails remain in place
1. Run:
```bash
cd /tmp/time-control-hub
npx vitest run tests/cycle15_security_authz.test.ts
```
2. Expected:
- Source contract checks pass.
- Optional live endpoint checks run only when explicitly enabled.

### 7. Document closure
1. Attach probe report and test output under `/tmp/time-control-hub/review/evidence`.
2. Update finding status:
- `F004` to `closed` only if probe reports zero active credentials and fixture surfaces remain locked down.
3. Record owner, date, and approver in release notes/change log.

## Acceptance Criteria
1. No credential from the exposed inventory can log in.
2. Fixture/test accounts are removed or disabled outside dedicated test environments.
3. Session revocation evidence exists for rotated users.
4. Exposed kiosk default PINs are rotated and fail authentication.
5. Lote 1 security regression suites remain green.
