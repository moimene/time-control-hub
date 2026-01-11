## 2024-05-22 - Icon-only Buttons Accessibility
**Learning:** Many icon-only buttons in admin views lack `aria-label`, relying only on `title` which is insufficient for screen readers.
**Action:** Systematically audit and add `aria-label` to all `Button` components with `size="icon"` or `variant="ghost"` that don't have text content.
