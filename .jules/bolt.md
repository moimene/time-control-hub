# Bolt's Performance Journal

## 2024-05-22 - Client-Side Filtering Optimization
**Learning:** React component filtering logic often redundantly calculates invariant transformations (like `.toLowerCase()`) inside loops.
**Action:** Always hoist invariant transformations outside of `filter` or `map` loops and use `useMemo` for derived state to prevent unnecessary re-calculations on every render.
