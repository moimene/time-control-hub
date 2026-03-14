## 2024-05-22 - Accessibility in Admin Tables
**Learning:** Icon-only buttons in admin tables (using `variant="ghost"` and `size="icon"`) often lack `aria-label` attributes, relying only on `title` or visual icons. This makes them inaccessible to screen reader users who can't see the icon or the tooltip.
**Action:** Always verify that buttons with `size="icon"` have an explicit `aria-label` describing the action (e.g., "Edit employee", "Delete record").
