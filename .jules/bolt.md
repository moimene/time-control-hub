# Bolt Journal

## 2024-05-22 - Client-side Filtering Optimization
**Learning:** Large lists filtered on the client-side cause re-renders of the entire list when unrelated state changes (like opening a dialog).
**Action:** Use `useMemo` to memoize the filtered results, ensuring the potentially expensive filtering logic only runs when the source data or filter criteria actually change.
