# Bolt's Journal

This file tracks critical performance learnings and decisions.

## 2025-02-18 - Client-Side Filtering Optimization
**Learning:** Found repetitive O(n*m) filtering logic in `TimeRecords.tsx` where string normalization happened inside the loop. Similar patterns likely exist in other admin tables (e.g., `Employees.tsx`).
**Action:** Use `useMemo` for filtered lists and hoist invariant transformations (like `search.toLowerCase()`) outside the loop.
