# Setup Flow Repair — Design Spec

**Date:** 2026-03-14
**Status:** Approved
**Scope:** Repair the company onboarding and configuration setup flow end-to-end

---

## Problem Summary

Playwright review of the dev environment identified 5 broken gaps in the setup flow:

| ID | Gap | Root Cause |
|----|-----|-----------|
| P0-A | `get_company_setup_status` returns 404 | SQL function exists locally but not deployed to Supabase |
| P0-B | New company has no jornada/convenio after signup | `seed_default_rule_sets` not deployed; bootstrap non-blocking |
| P1-A | Wizard "Publicar plantilla" creates a draft, not a published template | `StepPublish.handlePublish` does `setTimeout(1500)` + `onComplete()` — no API call |
| P1-B | Publishing a template never creates `rule_assignments` | `templates-publish` marks the version published but does not INSERT into `rule_assignments` |
| P1-C | Setup steps are not discoverable from the sidebar | `/admin/templates` and `/admin/calendar-laboral` are absent from `AppLayout.tsx`; SQL checklist points calendar to `/admin/settings` instead of `/admin/calendar-laboral` |

Additionally: no UI exists for assigning a published template to an employee (prerequisite for `jornada_rules` and `convenio` checklist checks).

---

## Approach

Targeted, ordered fixes. Each sub-task is independently deployable:

1. Deploy missing SQL functions to Supabase backend
2. Fix wizard publish flow (parents call `templates-publish` after `createRuleSet`)
3. New `EmployeeTemplateDialog` for per-employee jornada assignment
4. Sidebar navigation + SQL checklist path correction

---

## Sub-task 1: Deploy Missing SQL Functions

### What

Two PostgreSQL functions exist in local migrations but are absent from the live Supabase backend:

**A. `get_company_setup_status(p_company_id UUID) RETURNS JSONB`**
- File: `supabase/migrations/20260314000000_company_setup_status.sql`
- Fix file: `supabase/migrations/20260314120000_fix_setup_status_caller_validation.sql`
- Both must be applied via Supabase MCP `apply_migration`

**B. `seed_default_rule_sets(p_company_id UUID)`**
- File: `supabase/migrations/20260111000003_add_rule_templates.sql`
- Contains the full function definition; apply via MCP

### Also Deploy Edge Functions

8 edge functions have local changes not yet in Supabase:
- `get-test-credentials`, `run-compliance-tests`, `seed-compliance-data`, `seed-v1-fixtures`, `setup-test-data`, `setup-test-users` — security fix (remove `localHost` hostname check)
- `message-read`, `message-respond` — admin audit access fix

Deploy each via `mcp__claude_ai_Supabase__deploy_edge_function`.

### Also Fix: Calendar Path in SQL Checklist

The deployed `get_company_setup_status` has:
```sql
'path', '/admin/settings'   -- for calendar_published check
```
Should be:
```sql
'path', '/admin/calendar-laboral'
```

Fix via a new migration: `20260314130000_fix_setup_status_calendar_path.sql` using `CREATE OR REPLACE FUNCTION`.

### Acceptance Criteria

- `SELECT get_company_setup_status('<any-valid-uuid>')` returns JSON without error
- `SELECT seed_default_rule_sets('<any-valid-uuid>')` executes without PGRST202
- `SetupReminderBanner` renders with real data for existing companies
- `SetupGate` correctly redirects new companies to `/admin/setup`

---

## Sub-task 2: Fix Wizard Publish Flow

### Current Flow (broken)

```
StepPublish.handlePublish()
  → updateNestedPayload('meta', { effective_from, effective_to, version })
  → setTimeout(1500)           ← fake delay
  → onComplete(payload)        ← parent invoked

ConfigWizardButton.handleWizardComplete(payload)  [same in Templates.tsx]
  → createRuleSet.mutateAsync({ name, payload, ... })
  → returns { ruleSet, version }
  → NOTHING calls templates-publish    ← gap
```

### Fixed Flow

The key insight: `onComplete` is changed from `() => void` to `() => Promise<void>`. This allows `StepPublish` to await the full create+publish work that happens in the parent, driving the local `isPublishing` spinner accurately.

```
StepPublish.handlePublish()
  → setIsPublishing(true)
  → updateNestedPayload('meta', { effective_from, ... })
  → await onComplete()          ← parent does the real work, StepPublish awaits it
  → setIsPublishing(false)      ← only reached on success (parent throws on error)

ConfigWizardButton.handleWizardComplete()  [same in Templates.tsx]
  → reads payload from WizardContext.state.payload (not passed as arg)
  → result = await createRuleSet.mutateAsync({ name, payload, ... })
  → await supabase.functions.invoke('templates-publish', {
       body: { rule_version_id: result.version.id, effective_from: payload.meta?.effective_from }
     })
  → if invoke error: toast.error + throw (so StepPublish catches it and resets spinner)
  → if success: toast.success, close wizard/sheet
```

### Files to Modify

- `src/components/settings/ConfigWizardButton.tsx` — change `handleWizardComplete` to be async and call `templates-publish` after `createRuleSet`; read payload from `useWizard().state.payload` instead of arg
- `src/pages/admin/Templates.tsx` — same change as above
- `src/components/templates/wizard/WizardContext.tsx` — already exports `state.payload`; no change needed
- `src/components/templates/wizard/steps/StepPublish.tsx` — change `onComplete: () => void` to `onComplete: () => Promise<void>`; wrap `await onComplete()` in try/catch to reset `isPublishing` on error; remove `setTimeout(1500)`
- `src/components/templates/TemplateWizard.tsx` — update the `onComplete` prop type in the wizard's `handleComplete` callback to be `async () => Promise<void>` and pass it down to `StepPublish`

### Acceptance Criteria

- After completing the wizard, `rule_sets.status = 'published'` and `rule_versions.published_at IS NOT NULL`
- `toast.success` message includes a note: "Asigna la plantilla a tus empleados desde Empleados → Jornada"
- On `templates-publish` failure, wizard stays open with an error toast

---

## Sub-task 3: Employee Template Assignment Dialog

### New Component: `src/components/employees/EmployeeTemplateDialog.tsx`

Follows the same pattern as `EmployeeQrDialog`, `EmployeePinDialog`, `EmployeeCredentialsDialog`.

**Props:**
```typescript
interface EmployeeTemplateDialogProps {
  employee: { id: string; first_name: string; last_name: string; employee_code: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Dialog content:**

1. **Current assignment section:**
   - Query: `rule_assignments?employee_id=eq.{id}&is_active=eq.true&select=id,rule_version_id,effective_from,rule_versions(rule_sets(name,convenio))`
   - Display: template name + convenio, or "Sin jornada asignada"

2. **Select new template:**
   - Query: `rule_sets?company_id=eq.{companyId}&status=eq.published&select=id,name,convenio,rule_versions(id,published_at)&order=name`
   - Each rule set may have multiple versions; pick the latest by sorting `rule_versions` by `published_at DESC` client-side and taking `versions[0].id` as the select value
   - Exclude rule sets where `rule_versions` is empty (no published version yet — defensive check)
   - `<Select>` dropdown with `{name} — {convenio || 'Sin convenio'}` as label per option, value = latest `rule_version_id`

3. **Effective from date:**
   - `<Input type="date">` defaulting to today

4. **"Asignar" button:**
   - Step 1: `UPDATE rule_assignments SET is_active=false WHERE employee_id=X AND is_active=true`
   - Step 2: `INSERT INTO rule_assignments { company_id, employee_id, rule_version_id, is_active: true, effective_from, priority: 1 }`
   - On success: `invalidateQueries(['company-setup-status'])` + `toast.success`
   - On error: `toast.error`

### Changes to `Employees.tsx`

- Import `EmployeeTemplateDialog`
- Add state: `templateEmployee` + `templateDialogOpen`
- Add action button in row (between Credentials and QR):
  ```tsx
  <Button variant="ghost" size="icon" title="Asignar jornada"
    onClick={() => { setTemplateEmployee(employee); setTemplateDialogOpen(true); }}>
    <Briefcase className="h-4 w-4" />
  </Button>
  ```
- Render `<EmployeeTemplateDialog>` alongside the other dialogs

### Acceptance Criteria

- Clicking the Briefcase icon opens the dialog
- Selecting a published template and saving creates a row in `rule_assignments` with `is_active=true`
- Assigning to a second employee creates a second row (not overwriting)
- After assignment, `useCompanySetup` cache is invalidated → `SetupReminderBanner` updates within 30s

---

## Sub-task 4: Sidebar + Navigation

### `src/components/layout/AppLayout.tsx`

Add two nav items between `Empleados` and `Ausencias`:

```typescript
{ href: '/admin/templates',        label: 'Plantillas',  icon: <Wand2 className="h-5 w-5" />,         adminOnly: true },
{ href: '/admin/calendar-laboral', label: 'Calendario',  icon: <CalendarRange className="h-5 w-5" />, adminOnly: true },
```

Import `Wand2` and `CalendarRange` from `lucide-react`.

### Acceptance Criteria

- Both links appear in the admin sidebar for `admin` and `responsible` roles
- Links are absent for `employee` role (handled by `adminOnly: true` filter)

### Also: `src/components/admin/SetupGate.tsx`

Add `/admin/calendar-laboral` to `SETUP_EXEMPT_PATHS`. Current list is missing it:
```typescript
const SETUP_EXEMPT_PATHS = [
  '/admin/setup',
  '/admin/settings',
  '/admin/templates',
  '/admin/employees',
  '/admin/terminals',
  '/admin/calendar-laboral',   // ← add this
];
```

Without this, an admin redirected to `/admin/setup` who clicks "Configurar" on the `calendar_published` check would be immediately redirected away from `/admin/calendar-laboral` back to `/admin/setup`.

---

## Data Model: `rule_assignments`

```sql
rule_assignments (
  id           UUID PRIMARY KEY,
  company_id   UUID NOT NULL,
  employee_id  UUID,          -- NULL = company-wide default (not used in MVP)
  rule_version_id UUID NOT NULL REFERENCES rule_versions(id),
  is_active    BOOLEAN DEFAULT true,
  priority     INT DEFAULT 1,
  effective_from DATE,
  created_at   TIMESTAMPTZ DEFAULT now()
)
```

One active assignment per employee enforced at application level (deactivate before insert).

**Known limitation:** The deactivate+insert is two sequential client-side operations with no DB-level atomicity. In a slow network scenario, a browser close between step 1 and step 2 would leave the employee with zero active assignments. Acceptable for dev; a future migration can add a unique partial index `UNIQUE (employee_id) WHERE is_active = true` or wrap both steps in a single RPC.

---

## Setup Checklist — Post-Fix State

After all 4 sub-tasks, the critical checks resolve as follows:

| Check | Satisfied when |
|-------|---------------|
| `jornada_rules` | At least one active `rule_assignment` for the company |
| `convenio` | Active assignment whose `rule_version.payload_json.meta.convenio` is non-empty |
| `calendar_published` | `labor_calendars` with `published_at IS NOT NULL` for current year (path fixed to `/admin/calendar-laboral`) |
| `employees` | More than 1 active employee |

---

## Out of Scope

- Bulk-assign a template to all employees at once (enhancement for later)
- Template versioning UI (updating an existing assignment to a new template version)
- `seed_default_rule_sets` auto-assigning to employees (not desired; per-employee assignment is the model)
