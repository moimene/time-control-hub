# Analysis of Current State vs TEST_PLAN_V1

## Identified Gaps

### 1. RLS & Multi-tenancy (Cycle 1)
- **CRITICAL BUG**: Several RLS policies in `20260106073715` and `20260106094329` have flipped arguments in `user_belongs_to_company(company_id, auth.uid())`. This breaks access control for Rule Sets, Violations, Incidents, and Certificates.
- **Asesor Laboral Role**: The `app_role` enum does not include `asesor`. Access control for this role needs to be defined and implemented.
- **RLS Verification**: Need to ensure `user_belongs_to_company` covers all entry points for an external adviser linked to multiple companies.

### 2. Onboarding & Fixtures (Cycle 2 & 3)
- **Seed Data**: Current `setup-test-data` uses generic names. We need the specific 3-company dataset (Bar Pepe, Clínica Vet, Tienda Centro) with their specific timezones and roles.
- **Rule Seeding**: `company-bootstrap` seeds many things but misses default `rule_sets` assignment by sector.

### 3. Kiosk Flow (Cycle 4)
- **Offline Support**: Frontend has a robust `useOfflineQueue` and backend `kiosk-clock` handles `sync_offline`. Need to verify the "offline validation" (caching of PINs/QR tokens).
- **Idempotency**: Handled via `offline_uuid` in `kiosk-clock`.

### 4. Compliance Engine (Cycle 9)
- **Static vs Dynamic**: The `compliance-evaluator` edge function currently uses hardcoded constants for rules (`MAX_DAILY_HOURS`, etc.).
- **Missing precendece**: Precedence Ley -> Convenio -> Contrato -> Excepción is not yet implemented in the evaluator logic. It should read from `rule_assignments` and `rule_versions`.

### 5. Digital Evidence & QTSP (Cycle 10)
- **Daily Roots**: Logic exists but needs to be triggered for all test companies and verified with the Digital Trust API.
- **Forensic Export**: Need to verify the bundle creation including Merkle proofs.

## Planned Remediation

1. [x] **RLS Fix**: Created migration `20260111000000_fix_rls_flipped_args.sql`.
2. [ ] **New Fixtures**: Create `supabase/functions/seed-v1-fixtures/index.ts`.
3. [ ] **Adviser Role**: Add `asesor` to `app_role` and update policies.
4. [ ] **Dynamic Compliance**: Refactor `compliance-evaluator` to use DB-defined rules.
