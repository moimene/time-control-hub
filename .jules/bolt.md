## 2024-05-22 - Client-side Filtering Optimization
**Learning:** Client-side filtering of large lists in render loops causes performance bottlenecks. Computing invariant transformations (like `toLowerCase()`) inside the loop multiplies the cost by N.
**Action:** Use `useMemo` to cache filter results and hoist invariant transformations outside the loop.
