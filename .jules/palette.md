## 2025-01-27 - Accessible Admin Tables
**Learning:** Admin tables in this project frequently use icon-only buttons (Edit, Delete, QR, etc.) and search inputs without visible labels. These create significant barriers for screen reader users if `aria-label` is missing.
**Action:** systematically audit all admin tables (like `Employees.tsx`) and enforce `aria-label` on all `Input` components used for search and all `Button` components with `size="icon"`.
