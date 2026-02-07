import { test, expect } from '@playwright/test';
import { env, loginWithEmailPassword, logout } from './e2e_utils';

const responsibleEmail = env('TEST_RESPONSIBLE_EMAIL');
const responsiblePassword = env('TEST_RESPONSIBLE_PASSWORD');

test.describe('Responsible', () => {
  test.skip(
    !responsibleEmail || !responsiblePassword,
    'Missing TEST_RESPONSIBLE_EMAIL/TEST_RESPONSIBLE_PASSWORD',
  );

  test('Can login but cannot open /admin/employees', async ({ page }) => {
    await loginWithEmailPassword(page, responsibleEmail!, responsiblePassword!, /\/admin(?:$|\/)/);

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Registros' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Empleados' })).toHaveCount(0);

    // Direct navigation should bounce back to an allowed route.
    await page.goto('/admin/employees', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/admin(?:$|\/)/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await logout(page);
  });
});
