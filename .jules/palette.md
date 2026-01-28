## 2026-01-28 - Accessibility of Icon-Only Buttons
**Learning:** Admin interfaces in this project frequently use icon-only buttons for actions like Edit, Delete, and custom actions (QR, Credentials), often missing `aria-label` attributes which makes them inaccessible to screen readers.
**Action:** Always check `size="icon"` button usages and ensure they have a descriptive `aria-label` or `title` (preferably `aria-label` for better support). Use `title` for tooltip-like behavior on hover if a dedicated tooltip component isn't used.
