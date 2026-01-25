## 2026-01-08 - Secrets in Documentation
**Vulnerability:** Hardcoded API credentials (Client ID, Client Secret, Auth URL) were found in a deployment documentation file (`LOVABLE_DEPLOY_QTSP.md`).
**Learning:** Documentation files are often overlooked by automated security scanners or manual reviews that focus on source code. Developers may paste real credentials to facilitate "copy-paste" deployment steps, forgetting they are committing to a shared repository.
**Prevention:** Treat documentation as code. Use environment variable placeholders (e.g., `<your-client-secret>`) in examples. Configure pre-commit hooks or CI scanners to check all files, including Markdown, for potential high-entropy strings or known secret patterns.
