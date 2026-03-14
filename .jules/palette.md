## 2024-05-21 - Ghost Icon Buttons in Tables
**Learning:** This codebase frequently uses `variant="ghost" size="icon"` buttons in tables without `aria-label`, relying only on `title` which is insufficient for screen readers.
**Action:** When touching admin tables, always check for icon-only buttons and add explicit `aria-label` describing the action (e.g., "Edit employee" vs just "Edit").
