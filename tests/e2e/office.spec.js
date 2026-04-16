const { test, expect } = require('@playwright/test');

test.describe('Office Page', () => {
  test.beforeEach(async ({ page }) => {
    // Register and set up avatar to get to office
    await page.goto('/');
    await page.click('button:has-text("Registro")');

    const uniqueEmail = `office_test_${Date.now()}@madoffice.com`;
    await page.fill('input[type="email"]', uniqueEmail);
    await page.fill('input[type="text"]', 'Office Test');
    await page.click('button[type="submit"]:has-text("Registrarse")');

    await expect(page.locator('.avatar-gen-title')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Guardar y Entrar")');

    await expect(page.locator('.office-page')).toBeVisible({ timeout: 10000 });
  });

  test('should display office header with user name and logout', async ({ page }) => {
    await expect(page.locator('.office-logo')).toContainText('Mad Office');
    await expect(page.locator('.office-user-name')).toContainText('Office Test');
    await expect(page.locator('button:has-text("Salir")')).toBeVisible();
  });

  test('should display canvas with office map', async ({ page }) => {
    await expect(page.locator('.office-canvas')).toBeVisible();
  });

  test('should display sidebar with team list', async ({ page }) => {
    await expect(page.locator('.sidebar-title:has-text("Equipo")')).toBeVisible();
    // Should have at least the base users + the test user
    const teamMembers = page.locator('.team-member');
    await expect(teamMembers.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display mood details when clicking a team member', async ({ page }) => {
    const firstMember = page.locator('.team-member').first();
    await firstMember.click();

    await expect(page.locator('.mood-bars')).toBeVisible();
    await expect(page.locator('.mood-bar-row')).toHaveCount(6);
  });

  test('should display event log section', async ({ page }) => {
    await expect(page.locator('.sidebar-title:has-text("Eventos")')).toBeVisible();
  });

  test('should logout and return to landing', async ({ page }) => {
    await page.click('button:has-text("Salir")');
    await expect(page.locator('.hero-title')).toBeVisible({ timeout: 5000 });
  });
});
