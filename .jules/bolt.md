## 2025-05-24 - Client-Side Filtering Optimization
**Learning:** Large lists filtered client-side (e.g., `TimeRecords.tsx`, `Employees.tsx`) were re-computing filters and `toLowerCase()` operations on every render. This O(N*M) operation inside the render loop causes performance degradation as dataset size grows.
**Action:** Always wrap client-side filtered lists in `useMemo` and hoist invariant transformations (like `search.toLowerCase()`) outside the filter loop to ensure O(N) complexity is only paid when inputs change.
