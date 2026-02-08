import { test, expect } from '@playwright/test';
import { env, loginWithEmailPassword, logout, pageTitle } from './e2e_utils';

const adminEmail = env('TEST_ADMIN_EMAIL');
const adminPassword = env('TEST_ADMIN_PASSWORD');

type RouteCase = {
  name: string;
  path: string;
  // Some routes redirect (e.g. legacy pages). Match the final location.
  finalUrl: RegExp;
  heading: string;
};

const ADMIN_ROUTES: RouteCase[] = [
  { name: 'Dashboard', path: '/admin', finalUrl: /\/admin(?:$|\/)/, heading: 'Dashboard' },
  { name: 'Employees', path: '/admin/employees', finalUrl: /\/admin\/employees(?:$|\/)/, heading: 'Empleados' },
  {
    name: 'Clocking Devices',
    path: '/admin/clocking-devices',
    finalUrl: /\/admin\/clocking-devices(?:$|\/)/,
    heading: 'Dispositivos de Fichaje',
  },
  {
    name: 'Time Records',
    path: '/admin/time-records',
    finalUrl: /\/admin\/time-records(?:$|\/)/,
    heading: 'Registros de Jornada',
  },
  {
    name: 'Corrections',
    path: '/admin/corrections',
    finalUrl: /\/admin\/corrections(?:$|\/)/,
    heading: 'Correcciones',
  },
  {
    name: 'Orphan Clock-ins',
    path: '/admin/orphan-clockins',
    finalUrl: /\/admin\/orphan-clockins(?:$|\/)/,
    heading: 'Fichajes Huérfanos',
  },
  {
    name: 'Reports',
    path: '/admin/reports',
    finalUrl: /\/admin\/reports(?:$|\/)/,
    heading: 'Informes y Certificados',
  },
  // Legacy route: integrated into Reports, so we assert the redirect target.
  {
    name: 'QTSP Evidence (redirect)',
    path: '/admin/qtsp',
    finalUrl: /\/admin\/reports(?:$|\/)/,
    heading: 'Informes y Certificados',
  },
  { name: 'Audit Log', path: '/admin/audit', finalUrl: /\/admin\/audit(?:$|\/)/, heading: 'Registro de Auditoría' },
  {
    name: 'Compliance',
    path: '/admin/compliance',
    finalUrl: /\/admin\/compliance(?:$|\/)/,
    heading: 'Cumplimiento Normativo',
  },
  {
    name: 'Compliance Incidents',
    path: '/admin/compliance/incidents',
    finalUrl: /\/admin\/compliance\/incidents(?:$|\/)/,
    heading: 'Gestión de Incidencias',
  },
  {
    name: 'Templates',
    path: '/admin/templates',
    finalUrl: /\/admin\/templates(?:$|\/)/,
    heading: 'Reglas de Cumplimiento',
  },
  {
    name: 'Absences',
    path: '/admin/absences',
    finalUrl: /\/admin\/absences(?:$|\/)/,
    heading: 'Gestión de Ausencias',
  },
  {
    name: 'Legal Documents',
    path: '/admin/legal-documents',
    finalUrl: /\/admin\/legal-documents(?:$|\/)/,
    heading: 'Documentos Legales',
  },
  {
    name: 'Data Retention',
    path: '/admin/data-retention',
    finalUrl: /\/admin\/data-retention(?:$|\/)/,
    heading: 'Retención de Datos',
  },
  {
    name: 'Contingency Records',
    path: '/admin/contingency-records',
    finalUrl: /\/admin\/contingency-records(?:$|\/)/,
    heading: 'Registros de Contingencia',
  },
  {
    name: 'ITSS Package Generator',
    path: '/admin/itss-package',
    finalUrl: /\/admin\/itss-package(?:$|\/)/,
    heading: 'Generador de Paquete ITSS',
  },
  {
    name: 'Labor Calendar',
    path: '/admin/calendar-laboral',
    finalUrl: /\/admin\/calendar-laboral(?:$|\/)/,
    heading: 'Calendario Laboral',
  },
  {
    name: 'Clocking Incidents',
    path: '/admin/clocking-incidents',
    finalUrl: /\/admin\/clocking-incidents(?:$|\/)/,
    heading: 'Incidencias de Fichaje',
  },
  {
    name: 'Certified Communications',
    path: '/admin/communications',
    finalUrl: /\/admin\/communications(?:$|\/)/,
    heading: 'Comunicaciones Certificadas',
  },
  { name: 'Settings', path: '/admin/settings', finalUrl: /\/admin\/settings(?:$|\/)/, heading: 'Configuración' },
];

test.describe('Admin Navigation (Exhaustive)', () => {
  test.skip(!adminEmail || !adminPassword, 'Missing TEST_ADMIN_EMAIL/TEST_ADMIN_PASSWORD');

  test('Can open all admin routes (no 404)', async ({ page }) => {
    // This test is intentionally broad. Give it enough time to visit all routes.
    test.setTimeout(180_000);

    await loginWithEmailPassword(page, adminEmail!, adminPassword!, /\/admin(?:$|\/)/);
    await expect(pageTitle(page, 'Dashboard')).toBeVisible();

    for (const route of ADMIN_ROUTES) {
      await test.step(route.name, async () => {
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await page.waitForURL(route.finalUrl, { timeout: 30_000 });

        // Defensive: ensure we didn't fall through to the SPA 404 route.
        await expect(page.getByRole('heading', { name: '404' })).toHaveCount(0);

        await expect(pageTitle(page, route.heading)).toBeVisible();
      });
    }

    await logout(page);
  });
});
