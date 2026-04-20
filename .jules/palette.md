## 2024-05-24 - Missing ARIA on Icon-Only Buttons
**Learning:** Admin views (e.g., `Employees.tsx`) frequently use `size="icon"` buttons with `title` attributes but lack `aria-label`. `title` is insufficient for accessibility.
**Action:** When working on admin tables, always check icon-only buttons for `aria-label` and add it if missing, mirroring the `title` or intent.
