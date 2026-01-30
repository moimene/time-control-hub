## 2025-02-19 - Client-side Filtering Performance
**Learning:** Client-side filtering in large admin tables (e.g., `TimeRecords.tsx`) is a common bottleneck. Naive implementations re-calculate `toLowerCase()` inside filter loops (O(N) operations per render) and do not handle empty search states optimally.
**Action:** Always hoist invariant transformations (like `search.toLowerCase()`) outside the filter loop. Use `useMemo` to memoize the filtered result. Add an early return (`if (!search) return records;`) to skip filtering entirely when not needed (O(1)).
