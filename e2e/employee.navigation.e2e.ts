import { test, expect } from '@playwright/test';
import { env, loginWithEmailPassword, logout, pageTitle } from './e2e_utils';

const employeeEmail = env('TEST_EMPLOYEE_EMAIL');
const employeePassword = env('TEST_EMPLOYEE_PASSWORD');

test.describe('Employee Navigation (Exhaustive)', () => {
  test.skip(!employeeEmail || !employeePassword, 'Missing TEST_EMPLOYEE_EMAIL/TEST_EMPLOYEE_PASSWORD');

  test('Can open employee routes, and cannot access admin/super-admin/asesor routes', async ({ page }) => {
    test.setTimeout(120_000);

    await loginWithEmailPassword(page, employeeEmail!, employeePassword!, /\/employee(?:$|\/)/);
    await expect(pageTitle(page, 'Mis Fichajes')).toBeVisible();

    const employeeRoutes = [
      { name: 'Dashboard', path: '/employee', finalUrl: /\/employee(?:$|\/)/, heading: 'Mis Fichajes' },
      { name: 'Absences', path: '/employee/absences', finalUrl: /\/employee\/absences(?:$|\/)/, heading: 'Mis Ausencias' },
      { name: 'Monthly Closure', path: '/employee/closure', finalUrl: /\/employee\/closure(?:$|\/)/, heading: 'Cierre Mensual' },
      {
        name: 'Legal Documents',
        path: '/employee/legal-documents',
        finalUrl: /\/employee\/legal-documents(?:$|\/)/,
        heading: 'Normativa y Cumplimiento',
      },
      { name: 'Communications', path: '/employee/communications', finalUrl: /\/employee\/communications(?:$|\/)/, heading: 'Comunicaciones' },
      { name: 'Request Correction', path: '/employee/corrections', finalUrl: /\/employee\/corrections(?:$|\/)/, heading: 'Solicitar Corrección' },
      { name: 'My Requests', path: '/employee/requests', finalUrl: /\/employee\/requests(?:$|\/)/, heading: 'Mis Solicitudes' },
      { name: 'Notifications', path: '/employee/notifications', finalUrl: /\/employee\/notifications(?:$|\/)/, heading: 'Notificaciones' },
      { name: 'Settings', path: '/employee/settings', finalUrl: /\/employee\/settings(?:$|\/)/, heading: 'Configuración' },
    ];

    for (const route of employeeRoutes) {
      await test.step(route.name, async () => {
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await page.waitForURL(route.finalUrl, { timeout: 30_000 });
        await expect(page.getByRole('heading', { name: '404' })).toHaveCount(0);
        await expect(pageTitle(page, route.heading)).toBeVisible();
      });
    }

    // Protected sections should bounce an employee back to their home.
    const deniedRedirect = ['/admin', '/super-admin', '/asesor'];
    for (const path of deniedRedirect) {
      await test.step(`Denied (redirect): ${path}`, async () => {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await page.waitForURL(/\/employee(?:$|\/)/, { timeout: 30_000 });
        await expect(pageTitle(page, 'Mis Fichajes')).toBeVisible();
      });
    }

    // The test-credentials route should simply not exist (404), even for authenticated users.
    await test.step('Denied (404): /test-credentials', async () => {
      await page.goto('/test-credentials', { waitUntil: 'domcontentloaded' });
      await page.waitForURL(/\/test-credentials(?:$|\\?)/, { timeout: 30_000 });
      await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
      await expect(page.getByText('Credenciales de Prueba')).toHaveCount(0);
    });

    // Return to a shell route that includes the sign-out UI.
    await page.goto('/employee', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/employee(?:$|\/)/, { timeout: 30_000 });

    await logout(page);
  });
});
