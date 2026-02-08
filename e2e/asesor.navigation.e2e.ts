import { test, expect } from '@playwright/test';
import { env, loginWithEmailPassword, logout, pageTitle } from './e2e_utils';

const asesorEmail = env('TEST_ASESOR_EMAIL');
const asesorPassword = env('TEST_ASESOR_PASSWORD');

test.describe('Asesor Navigation (Exhaustive)', () => {
  test.skip(!asesorEmail || !asesorPassword, 'Missing TEST_ASESOR_EMAIL/TEST_ASESOR_PASSWORD');

  test('Can open asesor dashboard and drill into a read-only view', async ({ page }) => {
    test.setTimeout(120_000);

    await loginWithEmailPassword(page, asesorEmail!, asesorPassword!, /\/asesor(?:$|\/)/);
    await expect(pageTitle(page, 'Panel Asesor')).toBeVisible();

    // Ensure the company selector is present (assigned companies).
    await expect(page.getByText('Empresas Asignadas')).toBeVisible();

    // Drill into one view via quick actions.
    await page.getByRole('button', { name: 'Ver Empleados' }).click();
    await page.waitForURL(/\/asesor\/employees\?company=/, { timeout: 30_000 });
    await expect(pageTitle(page, 'Empleados')).toBeVisible();

    await logout(page);
  });
});
