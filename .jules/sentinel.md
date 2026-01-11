# Sentinel Journal 🛡️

## 2024-05-22 - Insecure Key Storage in Kiosk Mode
**Vulnerability:** Encryption keys (`kiosk_device_secret`, `kiosk_encryption_key`) are stored in `localStorage` in `src/lib/offlineCrypto.ts`. This exposes keys to XSS attacks.
**Learning:** The Kiosk mode requirement for offline capability likely drove this architectural decision, accepting the risk of local storage key exposure in exchange for persistence without server contact.
**Prevention:** In the future, evaluate using IndexedDB with non-exportable Web Crypto API keys if browser support allows, or strictly limit XSS surface area (which we improved today).
