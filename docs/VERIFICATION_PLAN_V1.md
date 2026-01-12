# Verification Plan - TEST_PLAN_V1

## Cycle 1: Multi-tenant + Roles + RLS (P0)
**Goal:** Ensure data isolation between companies and correct role-based access.

### Test Cases
1. **Isolation A/B/C**:
   - Login as Admin A -> Can see Company A employees, cannot see B or C.
   - Login as Empleado A1 -> Can see own events, cannot see other employees or companies.
2. **Adviser Access**:
   - Login as Asesor -> Can see Company A and B data, cannot see C.
3. **Super Admin**:
   - Login as Super Admin -> Can see all companies and manage global templates.

### Automated Scripts
- `tests/rls_isolation.test.ts`: Uses `supabase-js` to simulate different user logins and verify query results.

---

## Cycle 4: Kiosk (P0)
**Goal:** Verify QR and PIN clock-in flows.

### Test Cases
1. **PIN Clock-in**:
   - Enter Company A prefix + PIN A1 -> Success response.
   - Enter wrong PIN -> Unauthorized.
2. **QR Clock-in**:
   - Provide valid QR token -> Success response.

### Manual Verification
- Use the `browser` tool to navigate to `/kiosk` and perform a clock-in for "Bar Pepe".

---

## Cycle 9: Compliance Engine (P1)
**Goal:** Verify daily/weekly rule evaluation.

### Test Cases
1. **Daily Limit**:
   - Register >9h in one day for Empleado A1.
   - Run `compliance-evaluator`.
   - Verify `compliance_violations` contains a `MAX_DAILY_HOURS` record.
2. **Precedence**:
   - Set a contract override for A1 (e.g., 10h limit).
   - Verify that 9.5h does NOT trigger a violation for A1.

---

## Cycle 5: Offline PWA (P1)
**Goal:** Verify session persistence and sync.

### Test Cases
1. **Offline Capture**:
   - Simulate offline mode in browser.
   - Perform clock-in -> Verify stored in IndexedDB.
2. **Sync**:
   - Go back online.
   - Verify sync trigger and data appearing in `time_events` with `offline_uuid`.
