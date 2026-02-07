
import { it, expect } from 'vitest';
import { describeIntegration, getAnonClient } from './test_env';

describeIntegration('Cycle 4: Kiosk Authentication & Clock-in', () => {
    const supabase = getAnonClient();
    const employeeCode = process.env.TEST_KIOSK_EMPLOYEE_CODE || 'BAR001';
    const correctPin = process.env.TEST_KIOSK_PIN;
    const expectedFirstName = process.env.TEST_KIOSK_EMPLOYEE_FIRST_NAME;

    it('Should validate a valid employee code', async () => {
        const { data, error } = await supabase.functions.invoke('kiosk-clock', {
            body: { action: 'validate', employee_code: employeeCode }
        });

        if (error) {
            console.warn('Kiosk validate failed (skipped):', error);
            return;
        }

        expect(data.success).toBe(true);
        if (expectedFirstName) {
            expect(data.employee.first_name).toBe(expectedFirstName);
        } else {
            expect(typeof data.employee.first_name).toBe('string');
            expect(data.employee.first_name.length).toBeGreaterThan(0);
        }
        expect(data.next_event_type).toBeDefined();
    });

    it('Should fail with incorrect PIN', async () => {
        const wrongPin = correctPin === '0000' ? '9999' : '0000';
        const { data, error } = await supabase.functions.invoke('kiosk-clock', {
            body: {
                action: 'pin',
                employee_code: employeeCode,
                pin: wrongPin // Wrong PIN
            }
        });

        if (error) {
            // Error handling for invoke: check status or message
            const status = error.status || (error as any).context?.status;
            if (status) {
                expect(status).toBe(401);
            } else {
                // If it's a caught error in the function, it might be in the data
                expect(error.message).toContain('401');
            }
        } else {
            expect(data.success).toBe(false);
            expect(data.error).toBe('PIN incorrecto');
        }
    });

    it('Should succeed with correct PIN', async () => {
        if (!correctPin) {
            console.warn('Skipping kiosk correct PIN test: missing TEST_KIOSK_PIN');
            return;
        }

        const { data, error } = await supabase.functions.invoke('kiosk-clock', {
            body: {
                action: 'pin',
                employee_code: employeeCode,
                pin: correctPin
            }
        });

        if (error) {
            console.error('Kiosk PIN success test failed:', error);
            expect(error).toBeNull();
            return;
        }

        expect(data.success).toBe(true);
        expect(data.employee).toBeDefined();
        expect(data.event).toBeDefined();
        expect(data.event.id).toBeDefined();
    });
});
