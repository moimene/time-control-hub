import { test, expect } from '@playwright/test';

test('Anonymous: / redirects to /auth', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/auth(?:$|\?)/, { timeout: 30_000 });
  await expect(page.locator('#login-email')).toBeVisible();
});

test('Anonymous: /admin redirects to /auth', async ({ page }) => {
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/auth(?:$|\?)/, { timeout: 30_000 });
  await expect(page.locator('#login-email')).toBeVisible();
});
