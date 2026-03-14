## 2024-05-22 - Missing ARIA Labels on Admin Actions
**Learning:** The admin dashboard uses many icon-only buttons (trash, edit, user-cog) which systematically lack `aria-label` attributes, relying only on `title`. This makes them inaccessible to screen readers.
**Action:** When adding new admin actions, always include `aria-label` alongside `title`.
