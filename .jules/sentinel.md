## 2024-05-24 - Stored XSS in Message Components
**Vulnerability:** Found `dangerouslySetInnerHTML` usage in `EmployeeMessageReader.tsx` and `KioskMessageViewer.tsx` rendering `content.body_html` without sanitization. This allows stored XSS if the message body contains malicious scripts.
**Learning:** React's `dangerouslySetInnerHTML` is safe only if the input is trusted or sanitized. The assumption that backend content is safe is dangerous, especially if admin accounts can be compromised or if there are other injection vectors.
**Prevention:** Always use a sanitization library like `dompurify` before passing content to `dangerouslySetInnerHTML`. Created a reusable `sanitizeHtml` utility in `src/lib/security.ts` to enforce this pattern.
