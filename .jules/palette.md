## 2025-02-18 - Admin Action Accessibility
**Learning:** Icon-only buttons in admin tables (Employees) lacked `aria-label`, relying only on `title` which is insufficient for screen readers and touch devices. `window.confirm` was used for destructive actions, providing a poor user experience.
**Action:** Always verify icon buttons have `aria-label`. Replace native confirm dialogs with `AlertDialog` for critical actions.
