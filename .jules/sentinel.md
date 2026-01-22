# Sentinel Journal 🛡️

## 2025-02-19 - Critical Secret Leak in Documentation
**Vulnerability:** Hardcoded Digital Trust client credentials (Client ID and Client Secret) were found in `LOVABLE_DEPLOY_QTSP.md`.
**Learning:** Documentation files are often overlooked during security reviews but can contain critical secrets intended for deployment guides.
**Prevention:** Use placeholders like `<your-secret>` in documentation and implement pre-commit hooks that scan for high-entropy strings or known key patterns.
