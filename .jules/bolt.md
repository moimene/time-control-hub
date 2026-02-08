## 2024-05-22 - Client-side Filtering Optimization
**Learning:** Large lists like `TimeRecords` were re-filtering on every render, causing performance degradation during interactions.
**Action:** Always wrap expensive list filtering logic (especially with string matching) in `useMemo` and hoist invariant transformations (like `toLowerCase()`) outside the loop.
