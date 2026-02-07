import { test, expect } from '@playwright/test';
import { env, loginWithEmailPassword, logout } from './e2e_utils';

const adminEmail = env('TEST_ADMIN_EMAIL');
const adminPassword = env('TEST_ADMIN_PASSWORD');

test.describe('Admin', () => {
  test.skip(!adminEmail || !adminPassword, 'Missing TEST_ADMIN_EMAIL/TEST_ADMIN_PASSWORD');

  test('Can login and open Employees', async ({ page }) => {
    await loginWithEmailPassword(page, adminEmail!, adminPassword!, /\/admin(?:$|\/)/);

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Empleados' })).toBeVisible();

    await page.getByRole('link', { name: 'Empleados' }).click();
    await page.waitForURL(/\/admin\/employees(?:$|\/)/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Empleados' })).toBeVisible();

    await logout(page);
  });
});
