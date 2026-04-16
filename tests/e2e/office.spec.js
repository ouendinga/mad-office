const { test, expect } = require('@playwright/test');

test.describe('Office Page', () => {
  test.beforeEach(async ({ page }) => {
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

  test('should display office header with user name, profile, avatar and logout buttons', async ({ page }) => {
    await expect(page.locator('.office-logo')).toContainText('Mad Office');
    await expect(page.locator('.office-user-name')).toContainText('Office Test');
    await expect(page.locator('button:has-text("Perfil")')).toBeVisible();
    await expect(page.locator('button:has-text("Avatar")')).toBeVisible();
    await expect(page.locator('button:has-text("Salir")')).toBeVisible();
  });

  test('should display virtual clock', async ({ page }) => {
    await expect(page.locator('.office-clock')).toBeVisible();
  });

  test('should display canvas', async ({ page }) => {
    await expect(page.locator('.office-canvas')).toBeVisible();
  });

  test('should display sidebar tabs (Equipo, Ranking, Chat)', async ({ page }) => {
    await expect(page.locator('.sidebar-tab:has-text("Equipo")')).toBeVisible();
    await expect(page.locator('.sidebar-tab:has-text("Ranking")')).toBeVisible();
    await expect(page.locator('.sidebar-tab:has-text("Chat")')).toBeVisible();
  });

  test('should show team list with connected users', async ({ page }) => {
    const teamMembers = page.locator('.team-member');
    await expect(teamMembers.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show bipolar mood bars when clicking a team member', async ({ page }) => {
    const firstMember = page.locator('.team-member').first();
    await firstMember.click();
    await expect(page.locator('.mood-bars')).toBeVisible();
    // 5 bipolar moods
    await expect(page.locator('.mood-bar-row')).toHaveCount(5);
  });

  test('should open ranking panel', async ({ page }) => {
    await page.click('.sidebar-tab:has-text("Ranking")');
    await expect(page.locator('.rankings')).toBeVisible();
  });

  test('should open chat panel and send message', async ({ page }) => {
    await page.click('.sidebar-tab:has-text("Chat")');
    await expect(page.locator('.chat-input')).toBeVisible();
    await page.fill('.chat-input', 'Hola equipo!');
    await page.click('button:has-text("Enviar")');
    await expect(page.locator('.chat-msg-text:has-text("Hola equipo!")')).toBeVisible({ timeout: 5000 });
  });

  test('should display emoji bar', async ({ page }) => {
    await expect(page.locator('.emoji-bar')).toBeVisible();
    const emojis = page.locator('.emoji-btn');
    await expect(emojis.first()).toBeVisible();
  });

  test('should open profile modal', async ({ page }) => {
    await page.click('button:has-text("Perfil")');
    await expect(page.locator('.modal-title:has-text("Mi Perfil")')).toBeVisible();
  });

  test('should logout and return to landing', async ({ page }) => {
    await page.click('button:has-text("Salir")');
    await expect(page.locator('.hero-title')).toBeVisible({ timeout: 5000 });
  });
});
