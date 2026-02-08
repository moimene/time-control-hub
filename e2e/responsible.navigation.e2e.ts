import { test, expect } from '@playwright/test';
import { env, loginWithEmailPassword, logout, pageTitle } from './e2e_utils';

const responsibleEmail = env('TEST_RESPONSIBLE_EMAIL');
const responsiblePassword = env('TEST_RESPONSIBLE_PASSWORD');

test.describe('Responsible Navigation (Exhaustive)', () => {
  test.skip(
    !responsibleEmail || !responsiblePassword,
    'Missing TEST_RESPONSIBLE_EMAIL/TEST_RESPONSIBLE_PASSWORD',
  );

  test('Can open responsible-allowed routes, and gets bounced from admin-only routes', async ({ page }) => {
    test.setTimeout(120_000);

    await loginWithEmailPassword(page, responsibleEmail!, responsiblePassword!, /\/admin(?:$|\/)/);
    await expect(pageTitle(page, 'Dashboard')).toBeVisible();

    // Allowed routes for responsible.
    const allowed = [
      { name: 'Dashboard', path: '/admin', finalUrl: /\/admin(?:$|\/)/, heading: 'Dashboard' },
      {
        name: 'Time Records',
        path: '/admin/time-records',
        finalUrl: /\/admin\/time-records(?:$|\/)/,
        heading: 'Registros de Jornada',
      },
      {
        name: 'Reports',
        path: '/admin/reports',
        finalUrl: /\/admin\/reports(?:$|\/)/,
        heading: 'Informes y Certificados',
      },
      {
        name: 'Corrections',
        path: '/admin/corrections',
        finalUrl: /\/admin\/corrections(?:$|\/)/,
        heading: 'Correcciones',
      },
    ];

    for (const route of allowed) {
      await test.step(`Allowed: ${route.name}`, async () => {
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await page.waitForURL(route.finalUrl, { timeout: 30_000 });
        await expect(page.getByRole('heading', { name: '404' })).toHaveCount(0);
        await expect(pageTitle(page, route.heading)).toBeVisible();
      });
    }

    // Admin-only routes should redirect to /auth and then auto-redirect back to /admin.
    const denied = [
      '/admin/employees',
      '/admin/settings',
      '/admin/absences',
      '/admin/communications',
      '/admin/audit',
      '/admin/compliance',
      '/admin/compliance/incidents',
      '/admin/templates',
      '/admin/clocking-incidents',
      '/admin/clocking-devices',
      '/admin/orphan-clockins',
      '/admin/legal-documents',
      '/admin/data-retention',
      '/admin/contingency-records',
      '/admin/itss-package',
      '/admin/calendar-laboral',
    ];

    for (const path of denied) {
      await test.step(`Denied: ${path}`, async () => {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await page.waitForURL(/\/admin(?:$|\/)/, { timeout: 30_000 });
        await expect(pageTitle(page, 'Dashboard')).toBeVisible();
      });
    }

    await logout(page);
  });
});
