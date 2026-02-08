import { test, expect } from '@playwright/test';

test('Anonymous: /test-credentials is disabled (NotFound)', async ({ page }) => {
  await page.goto('/test-credentials', { waitUntil: 'domcontentloaded' });

  // SPA returns 200, but route should not exist unless explicitly enabled.
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  await expect(page.getByText('Oops! Page not found')).toBeVisible();
  await expect(page.getByText('Credenciales de Prueba')).toHaveCount(0);
});

