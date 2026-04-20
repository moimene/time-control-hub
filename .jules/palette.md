## 2025-02-23 - Accessibility in Device Management
**Learning:** Icon-only buttons in administrative tables often lack `aria-label`, making them inaccessible to screen readers. This is a common pattern in tables with "Actions" columns.
**Action:** Always check `Button` components with `size="icon"` or `variant="ghost"` for `aria-label`. Use dynamic labels (e.g., "Delete [Name]") to provide context in lists.
