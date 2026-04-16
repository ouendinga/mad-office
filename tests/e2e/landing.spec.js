const { test, expect } = require('@playwright/test');

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the header with logo and buttons', async ({ page }) => {
    await expect(page.locator('.logo-text')).toContainText('Mad Office');
    await expect(page.locator('button:has-text("Login")')).toBeVisible();
    await expect(page.locator('button:has-text("Registro")')).toBeVisible();
  });

  test('should display hero section', async ({ page }) => {
    await expect(page.locator('.hero-title')).toContainText('Mad Office');
    await expect(page.locator('.hero .btn-primary')).toContainText('Registrate');
  });

  test('should display 3 step cards', async ({ page }) => {
    const steps = page.locator('.step-card');
    await expect(steps).toHaveCount(3);
  });

  test('should display 3 feature cards', async ({ page }) => {
    const features = page.locator('.feature-card');
    await expect(features).toHaveCount(3);
  });

  test('should display 3 testimonial cards', async ({ page }) => {
    const testimonials = page.locator('.testimonial-card');
    await expect(testimonials).toHaveCount(3);
  });

  test('should display footer with copyright', async ({ page }) => {
    await expect(page.locator('.landing-footer')).toContainText('2025 Mad Office');
  });

  test('should open register modal on Registro click', async ({ page }) => {
    await page.click('button:has-text("Registro")');
    await expect(page.locator('.modal-title')).toContainText('Crear cuenta');
    await expect(page.locator('.modal input[type="email"]')).toBeVisible();
    await expect(page.locator('.modal input[type="text"]')).toBeVisible();
  });

  test('should open login modal on Login click', async ({ page }) => {
    await page.click('button:has-text("Login")');
    await expect(page.locator('.modal-title')).toContainText('Iniciar sesion');
    await expect(page.locator('.modal input[type="email"]')).toBeVisible();
  });

  test('should close modal when clicking overlay', async ({ page }) => {
    await page.click('button:has-text("Login")');
    await expect(page.locator('.modal')).toBeVisible();
    await page.click('.modal-overlay', { position: { x: 10, y: 10 } });
    await expect(page.locator('.modal')).not.toBeVisible();
  });
});

test.describe('Registration Flow', () => {
  test('should register and redirect to avatar generator', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Registro")');
    await page.fill('input[type="email"]', `test_${Date.now()}@madoffice.com`);
    await page.fill('input[type="text"]', 'Test User');
    await page.click('button[type="submit"]:has-text("Registrarse")');
    await expect(page.locator('.avatar-gen-title')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Login Flow', () => {
  test('should login with existing user', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Login")');
    await page.fill('input[type="email"]', 'david@madoffice.com');
    await page.click('button[type="submit"]:has-text("Entrar")');
    await expect(page.locator('.avatar-gen, .office-page')).toBeVisible({ timeout: 10000 });
  });

  test('should show error for non-existent email', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Login")');
    await page.fill('input[type="email"]', 'nonexistent@madoffice.com');
    await page.click('button[type="submit"]:has-text("Entrar")');
    await expect(page.locator('.modal-error')).toBeVisible({ timeout: 5000 });
  });
});
