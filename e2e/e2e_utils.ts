import { expect, type Page } from '@playwright/test';

export function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value : undefined;
}

export function requireEnv(name: string): string {
  const value = env(name);
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function pageTitle(page: Page, title: string) {
  // Match the main page title (our layouts use an <h1> for the screen title).
  // Use exact matching to avoid strict-mode collisions (e.g. "Notificaciones" vs "Centro de Notificaciones").
  return page.getByRole('heading', { name: title, level: 1, exact: true });
}

export function employeeCodeLast3Digits(employeeCode: string): string {
  const match = employeeCode.match(/(\d{3})$/);
  if (!match) {
    throw new Error(`Employee code must end with 3 digits (got: "${employeeCode}")`);
  }
  return match[1];
}

export async function gotoAuth(page: Page): Promise<void> {
  await page.goto('/auth', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login-email')).toBeVisible();
}

export async function loginWithEmailPassword(
  page: Page,
  email: string,
  password: string,
  expectedPath: RegExp,
): Promise<void> {
  await gotoAuth(page);
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL(expectedPath, { timeout: 30_000 });
}

export async function logout(page: Page): Promise<void> {
  const signOut = page.getByRole('button', { name: 'Cerrar sesión' });
  await signOut.click();
  await page.waitForURL(/\/auth(?:$|\?)/, { timeout: 30_000 });
  await expect(page.locator('#login-email')).toBeVisible();
}
