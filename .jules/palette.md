# Palette's Journal

## 2026-01-22 - Admin Table Accessibility
**Learning:** Admin tables often contain icon-only buttons (Edit, Delete, Credentials) and search inputs that lack visible labels. These are critical accessibility gaps.
**Action:** Always check `Table` components in admin pages for icon-only `Button`s and `Input` fields. Add `aria-label` attributes using the button's purpose or the input's placeholder text as a guide.
