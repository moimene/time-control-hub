## 2025-05-23 - Replacing Native Confirm with AlertDialog
**Learning:** Native `window.confirm` dialogs are disruptive and lack styling consistency. The `AlertDialog` component provides a smoother, accessible experience but requires specific implementation patterns when used inside data tables (wrapping the trigger button directly).
**Action:** Replace `window.confirm` with `AlertDialog` components for all destructive actions. Wrap the trigger button directly in the `AlertDialog` structure within table cells to maintain a clean implementation without complex state management.
