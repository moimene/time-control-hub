import { describe, it, expect } from 'vitest';

// Simulating the logic used in supabase/functions/employee-change-pin/index.ts
// We cannot import it directly because it is an Edge Function using Deno globals.
function calculateLockout(employee: { pin_failed_attempts?: number | null }) {
    const currentAttempts = (employee.pin_failed_attempts || 0) + 1;
    const lockedUntil = currentAttempts >= 5
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null;

    return { currentAttempts, lockedUntil };
}

describe('Security Fix: Employee PIN Lockout Logic', () => {
    it('should handle undefined pin_failed_attempts (first failure)', () => {
        const employee = { pin_failed_attempts: undefined }; // Simulate missing field or null
        const result = calculateLockout(employee);

        expect(result.currentAttempts).toBe(1);
        expect(result.lockedUntil).toBeNull();
    });

    it('should handle null pin_failed_attempts (first failure)', () => {
        const employee = { pin_failed_attempts: null };
        const result = calculateLockout(employee);

        expect(result.currentAttempts).toBe(1);
        expect(result.lockedUntil).toBeNull();
    });

    it('should increment correctly', () => {
        const employee = { pin_failed_attempts: 1 };
        const result = calculateLockout(employee);

        expect(result.currentAttempts).toBe(2);
        expect(result.lockedUntil).toBeNull();
    });

    it('should NOT lock on 4th attempt (current was 3)', () => {
        const employee = { pin_failed_attempts: 3 };
        const result = calculateLockout(employee);

        expect(result.currentAttempts).toBe(4);
        expect(result.lockedUntil).toBeNull();
    });

    it('should LOCK on 5th attempt (current was 4)', () => {
        const employee = { pin_failed_attempts: 4 };
        const result = calculateLockout(employee);

        expect(result.currentAttempts).toBe(5);
        expect(result.lockedUntil).toBeDefined();

        const lockTime = new Date(result.lockedUntil!);
        const now = new Date();
        const diff = lockTime.getTime() - now.getTime();

        // Should be roughly 15 minutes (allowing for small execution delay)
        expect(diff).toBeGreaterThan(14 * 60 * 1000);
        expect(diff).toBeLessThan(16 * 60 * 1000);
    });

    it('should continue to lock on subsequent attempts (current was 5)', () => {
        const employee = { pin_failed_attempts: 5 };
        const result = calculateLockout(employee);

        expect(result.currentAttempts).toBe(6);
        expect(result.lockedUntil).toBeDefined();
    });
});
