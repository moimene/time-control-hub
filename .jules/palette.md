## 2024-05-23 - Accessibility in Admin Tables
**Learning:** Admin interfaces often pack many actions into small spaces using icon-only buttons. These are critical for efficiency but invisible to screen readers without explicit `aria-label` attributes.
**Action:** Always verify that every icon-only button in a data table has a unique, descriptive `aria-label` (e.g., "Edit employee John Doe" rather than just "Edit").
