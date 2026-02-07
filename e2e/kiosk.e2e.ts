import { test, expect } from '@playwright/test';
import { env, employeeCodeLast3Digits, gotoAuth } from './e2e_utils';

const adminEmail = env('TEST_ADMIN_EMAIL');
const adminPassword = env('TEST_ADMIN_PASSWORD');
const terminalName = env('TEST_KIOSK_TERMINAL_NAME');
const employeeCode = env('TEST_KIOSK_EMPLOYEE_CODE') || env('TEST_EMPLOYEE_CODE');
const employeePin = env('TEST_KIOSK_PIN') || env('TEST_EMPLOYEE_PIN');

test.describe('Kiosk', () => {
  test.skip(
    !adminEmail || !adminPassword || !terminalName || !employeeCode || !employeePin,
    'Missing kiosk env vars (TEST_ADMIN_*, TEST_KIOSK_TERMINAL_NAME, TEST_KIOSK_EMPLOYEE_CODE, TEST_KIOSK_PIN)',
  );

  test('Admin can activate terminal and employee can clock in/out via PIN', async ({ page }) => {
    const employeeDigits = employeeCodeLast3Digits(employeeCode!);

    // Activate kiosk session using admin creds.
    await gotoAuth(page);
    await page.getByRole('tab', { name: /Terminal/i }).click();

    await page.locator('#terminal-email').fill(adminEmail!);
    await page.locator('#terminal-password').fill(adminPassword!);
    await page.locator('#device-name').fill('E2E Terminal');
    await page.getByRole('button', { name: 'Activar Terminal' }).click();

    await page.waitForURL(/\/kiosk(?:$|\/)/, { timeout: 30_000 });

    // Select terminal.
    await expect(page.getByRole('heading', { name: 'Selecciona Terminal' })).toBeVisible();
    await page.getByText(terminalName!).click();

    // Home screen.
    await expect(page.getByRole('heading', { name: 'Control Horario' })).toBeVisible();

    // Go to PIN mode.
    await page.getByText('Código + PIN').click();
    await expect(page.getByText('Nº de Empleado')).toBeVisible();

    // Enter employee digits and then PIN (keyboard supported).
    await page.keyboard.type(employeeDigits);
    await page.keyboard.press('Enter');
    await expect(page.getByText('Introduce tu PIN de 4 dígitos')).toBeVisible();

    await page.keyboard.type(employeePin!);
    await page.keyboard.press('Enter');

    // Success screen should show ENTRY or EXIT for the employee code.
    await expect(page.getByText(/ENTRADA|SALIDA/)).toBeVisible();
    await expect(page.getByText(employeeCode!)).toBeVisible();
  });
});
