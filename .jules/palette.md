## 2025-02-18 - Replacing Native Confirmations
**Learning:** Browser native `confirm()` dialogs block the main thread and provide a jarring, inconsistent experience that can't be styled or made accessible in the same way as the rest of the application.
**Action:** Replace `window.confirm` with custom `AlertDialog` components from the design system. This ensures visual consistency, keyboard accessibility, and a non-blocking UI.

## 2025-02-18 - Icon-Only Buttons
**Learning:** Icon-only buttons are invisible to screen reader users without explicit labeling. `title` attributes are insufficient for accessibility.
**Action:** Always add `aria-label` to buttons that rely solely on iconography to convey their purpose.
