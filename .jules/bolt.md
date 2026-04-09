## 2024-05-23 - Client-side Filtering Optimization
**Learning:** Admin views (`Employees.tsx`, `AuditLog.tsx`, `TimeRecords.tsx`) perform client-side filtering on potentially large datasets. Invariant transformations (e.g., `search.toLowerCase()`) were previously executed inside the filter loop (O(N) * 3), causing unnecessary CPU overhead.
**Action:** Always wrap client-side filtering logic in `useMemo` and hoist invariant calculations (like `toLowerCase()`) outside the loop to ensure O(1) preparation and avoid re-renders.
