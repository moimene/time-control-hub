## 2025-05-26 - Hardcoded Secret in Documentation
**Vulnerability:** A real client secret `DIGITALTRUST_CLIENT_SECRET` was hardcoded in `LOVABLE_DEPLOY_QTSP.md`.
**Learning:** Even documentation files can leak secrets if they are used as "deployment guides" with real examples.
**Prevention:** Use placeholders like `[REDACTED]` or `your-secret-here` in all documentation, even internal ones.

## 2025-05-26 - XSS in Message Viewers
**Vulnerability:** `dangerouslySetInnerHTML` was used in `EmployeeMessageReader.tsx` and `KioskMessageViewer.tsx` with unsanitized `body_html` content.
**Learning:** React's protection is bypassed by `dangerouslySetInnerHTML`. Trusting database content (even if admin-generated) is risky if the input path isn't strictly controlled.
**Prevention:** Always use `dompurify` to sanitize HTML content before rendering it with `dangerouslySetInnerHTML`.
