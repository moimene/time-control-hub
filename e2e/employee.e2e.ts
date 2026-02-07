import { test, expect } from '@playwright/test';
import { env, loginWithEmailPassword, logout } from './e2e_utils';

const employeeEmail = env('TEST_EMPLOYEE_EMAIL');
const employeePassword = env('TEST_EMPLOYEE_PASSWORD');

test.describe('Employee', () => {
  test.skip(!employeeEmail || !employeePassword, 'Missing TEST_EMPLOYEE_EMAIL/TEST_EMPLOYEE_PASSWORD');

  test('Can login and cannot access /admin', async ({ page }) => {
    await loginWithEmailPassword(page, employeeEmail!, employeePassword!, /\/employee(?:$|\/)/);

    await expect(page.getByRole('heading', { name: 'Mis Fichajes' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mis Fichajes' })).toBeVisible();

    // Attempt to access the admin app; should end up back in employee space.
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/employee(?:$|\/)/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Mis Fichajes' })).toBeVisible();

    await logout(page);
  });
});
