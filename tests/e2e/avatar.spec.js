const { test, expect } = require('@playwright/test');

test.describe('Avatar Generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Registro")');
    const uniqueEmail = `avatar_test_${Date.now()}@madoffice.com`;
    await page.fill('input[type="email"]', uniqueEmail);
    await page.fill('input[type="text"]', 'Avatar Test');
    await page.click('button[type="submit"]:has-text("Registrarse")');
    await expect(page.locator('.avatar-gen-title')).toBeVisible({ timeout: 10000 });
  });

  test('should display avatar generator with canvas preview', async ({ page }) => {
    await expect(page.locator('.avatar-canvas')).toBeVisible();
    await expect(page.locator('.avatar-name')).toContainText('Avatar Test');
  });

  test('should display all 5 option selectors', async ({ page }) => {
    const selectors = page.locator('.option-selector');
    await expect(selectors).toHaveCount(5);
  });

  test('should save avatar and redirect to office', async ({ page }) => {
    await page.click('button:has-text("Guardar y Entrar")');
    await expect(page.locator('.office-page')).toBeVisible({ timeout: 10000 });
  });
});
