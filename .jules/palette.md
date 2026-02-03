## 2024-05-22 - Replace Native Confirm with AlertDialog
**Learning:** Native `window.confirm` is inaccessible and breaks visual consistency. Using `AlertDialog` provides a better experience but requires managing state (`open`, `dataToDelete`).
**Action:** When finding `window.confirm`, always refactor to `AlertDialog`. Ensure you handle the state for the item being acted upon (e.g., `employeeToDelete`).
