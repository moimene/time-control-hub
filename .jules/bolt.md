## 2025-02-18 - Client-side Filtering Bottlenecks
**Learning:** Large datasets like `employees` are filtered client-side on every render.
**Action:** Use `useMemo` for filtering logic to prevent recalculations on unrelated state changes (e.g., dialog toggles).
