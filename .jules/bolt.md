## 2024-05-22 - Client-Side Filtering Optimization
**Learning:** Client-side filtering in `Employees.tsx` was running O(n*m) string operations on every render.
**Action:** Use `useMemo` for filtered lists and hoist invariant transformations (like `search.toLowerCase()`) outside the filter loop. Pattern should be applied to `TimeRecords.tsx` next.
