## 2024-05-22 - Client-side Filtering Optimization Pattern
**Learning:** Admin views (`Employees.tsx`, `TimeRecords.tsx`) perform client-side filtering on Supabase data. Invariant transformations (e.g., `search.toLowerCase()`) were repeated in O(N) loops inside the render cycle causing unnecessary computation on every render.
**Action:** Extract filter logic to pure functions, use `useMemo` to cache results, hoist invariants outside loops, and early return on empty search to avoid iteration.
