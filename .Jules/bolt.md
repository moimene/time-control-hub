## 2024-05-23 - Client-side Filtering Optimization
**Learning:** Large lists filtered client-side (e.g. Employees table) cause significant re-renders on every keystroke if not debounced and memoized.
**Action:** Always use `useDebounce` for search inputs and `useMemo` for the derived filtered list to separate input responsiveness from calculation cost.
