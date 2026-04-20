## 2024-05-23 - XSS Prevention via DOMPurify
**Vulnerability:** Found multiple instances of `dangerouslySetInnerHTML` accepting unsanitized HTML content, posing a High/Critical Cross-Site Scripting (XSS) risk.
**Learning:** React's `dangerouslySetInnerHTML` is appropriately named. When rendering rich text or HTML content from database or user input, it must always be sanitized.
**Prevention:** Installed `dompurify` and created a `sanitizeHtml` helper in `src/lib/security.ts`. All usages of `dangerouslySetInnerHTML` should wrap the content with this helper.
