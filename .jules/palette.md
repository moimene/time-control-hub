## 2024-05-23 - Accessibility in Admin Tables
**Learning:** Icon-only buttons (like 'Edit' or 'Delete' in tables) and search inputs often lack descriptive labels, making them inaccessible to screen reader users. Adding `aria-label` provides necessary context without changing the visual design.
**Action:** Always audit tables for icon-only actions and inputs without labels, ensuring `aria-label` is present.
