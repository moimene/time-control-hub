## 2024-05-22 - Accessibility Labels and Performance
**Learning:** High-traffic administrative tables (Employees, TimeRecords) often lack `aria-label` attributes on search inputs and icon-only buttons, making them inaccessible to screen readers. Additionally, client-side filtering inside render loops can be inefficient.
**Action:** Always add `aria-label` to inputs and icon buttons. Use `useMemo` for client-side filtering to hoist invariant transformations (like `.toLowerCase()`) outside the loop.
