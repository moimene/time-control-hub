# Sentinel's Journal

## 2026-01-08 - Missing HTML Sanitization Infrastructure
**Vulnerability:** User-generated content in messages was rendered using `dangerouslySetInnerHTML` without any sanitization, and the `dompurify` library was missing entirely despite documentation suggesting otherwise.
**Learning:** Documentation or "memory" of security controls (like `src/lib/security.ts`) can be out of sync with reality. "Trust but verify" applies to internal security helpers too.
**Prevention:** Enforce usage of `sanitizeHtml` from `src/lib/security.ts` for all raw HTML rendering.
