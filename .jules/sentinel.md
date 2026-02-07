# Sentinel's Journal

## 2025-02-18 - [CRITICAL] Missing Field in Authentication Check Leads to Brute-Force Bypass
**Vulnerability:** The `employee-change-pin` Edge Function failed to select the `pin_failed_attempts` column from the database while relying on it for lockout logic. This caused the variable to be `undefined`, and `undefined + 1` resulted in `NaN`. Consequently, the lockout condition `NaN >= 4` always evaluated to `false`, effectively disabling the brute-force protection for PIN changes.
**Learning:** Selecting only specific columns in ORM/query builders is a good performance practice but a security risk if the logic depends on unselected fields. Type casting (`as any`) masked this error from the TypeScript compiler, allowing the bug to exist in production code.
**Prevention:** Always verify that all fields used in security logic are explicitly selected in the database query. Avoid using `as any` to bypass type checks on database responses; instead, define proper interfaces that match the selected fields. Implement automated tests that specifically exercise failure modes (like lockout thresholds) to catch regression.
