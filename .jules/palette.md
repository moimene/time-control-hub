# Palette's Journal

This file tracks critical UX and accessibility learnings for the project.

## Format
```markdown
## YYYY-MM-DD - [Title]
**Learning:** [UX/a11y insight]
**Action:** [How to apply next time]
```

## 2026-01-24 - Icon-only Buttons & Accessibility
**Learning:** Icon-only buttons with `title` attributes are insufficient for accessibility. `title` is not reliably announced by all screen readers and offers no benefit to touch users.
**Action:** Always add an explicit `aria-label` to icon-only buttons (e.g., `aria-label="Edit employee"`), even if a `title` tooltip is present.
