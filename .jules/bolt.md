## 2025-02-18 - Client-Side Filtering Optimization
**Learning:** Invariant string transformations (e.g., `search.toLowerCase()`) inside filter loops execute O(N) times on every render, causing unnecessary CPU overhead.
**Action:** Hoist invariant calculations outside the loop and memoize filtered lists with `useMemo` in data-heavy components.
