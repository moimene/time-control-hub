# BOLT'S JOURNAL - CRITICAL LEARNINGS ONLY

## 2024-05-23 - [Missing pnpm-lock.yaml]
**Learning:** The project instructions enforce `pnpm`, but `pnpm-lock.yaml` was missing, causing potential dependency discrepancies.
**Action:** Always verify lockfile presence when enforcing a package manager. Generated `pnpm-lock.yaml` to ensure deterministic builds.
