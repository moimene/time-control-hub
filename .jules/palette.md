## 2026-01-20 - Accessibility in Admin Tables
**Learning:** Admin interfaces with dense data tables frequently use icon-only buttons for actions like "Edit" or "Delete". These often lack `aria-label` attributes, relying solely on visual icons or hover tooltips, which excludes screen reader users.
**Action:** Audit all table action columns. Ensure every icon-only button has an `aria-label` that describes the action (e.g., "Edit employee", "Delete record").
