import { test, expect } from '@playwright/test';
import { env, loginWithEmailPassword, logout, pageTitle } from './e2e_utils';

const superAdminEmail = env('TEST_SUPER_ADMIN_EMAIL');
const superAdminPassword = env('TEST_SUPER_ADMIN_PASSWORD');

test.describe('Super Admin Navigation (Exhaustive)', () => {
  test.skip(
    !superAdminEmail || !superAdminPassword,
    'Missing TEST_SUPER_ADMIN_EMAIL/TEST_SUPER_ADMIN_PASSWORD',
  );

  test('Can open super-admin routes (no 404)', async ({ page }) => {
    test.setTimeout(120_000);

    await loginWithEmailPassword(page, superAdminEmail!, superAdminPassword!, /\/super-admin(?:$|\/)/);
    await expect(pageTitle(page, 'Panel Super Admin')).toBeVisible();

    const routes = [
      { name: 'Dashboard', path: '/super-admin', finalUrl: /\/super-admin(?:$|\/)/, heading: 'Panel Super Admin' },
      {
        name: 'Companies',
        path: '/super-admin/companies',
        finalUrl: /\/super-admin\/companies(?:$|\/)/,
        heading: 'Gestión de Empresas',
      },
      {
        name: 'Users',
        path: '/super-admin/users',
        finalUrl: /\/super-admin\/users(?:$|\/)/,
        heading: 'Gestión de Usuarios',
      },
      {
        name: 'Activity',
        path: '/super-admin/activity',
        finalUrl: /\/super-admin\/activity(?:$|\/)/,
        heading: 'Actividad Global',
      },
      {
        name: 'QTSP Monitor',
        path: '/super-admin/qtsp',
        finalUrl: /\/super-admin\/qtsp(?:$|\/)/,
        heading: 'Monitor QTSP Global',
      },
    ];

    for (const route of routes) {
      await test.step(route.name, async () => {
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await page.waitForURL(route.finalUrl, { timeout: 30_000 });
        await expect(page.getByRole('heading', { name: '404' })).toHaveCount(0);
        await expect(pageTitle(page, route.heading)).toBeVisible();
      });
    }

    await logout(page);
  });
});
