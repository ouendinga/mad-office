// Recorrido completo de una persona nueva: entrar → avatar → entrevista → ficha → oficina.
// Necesita la pila levantada y un despertador corriendo (con --fake para no gastar).
// Ojo: el primer registro de una base vacía se queda de admin.

const { test, expect } = require('@playwright/test');

const SHOTS = process.env.SHOTS_DIR || 'test-results';

test('una persona nueva tiene personaje en menos de 5 minutos y sin leer instrucciones', async ({ page }) => {
  test.setTimeout(180000);
  const email = `prueba-${Date.now()}@madoffice.test`;

  await page.goto('/');
  await expect(page.getByText('La oficina donde tu personaje vive solo')).toBeVisible();
  await page.getByRole('button', { name: 'Crear cuenta' }).first().click();
  await page.getByPlaceholder('tu@email.com').fill(email);
  await page.getByPlaceholder('Tu nombre').fill('Álvaro');
  await page.locator('form').getByRole('button', { name: 'Crear cuenta' }).click();

  // Avatar
  await expect(page.getByText('Así te verán en la oficina')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/1-avatar.png` });
  await page.locator('.avatar-generator button.btn-primary, button.btn-primary.btn-lg').last().click();

  // Entrevista: el botón de crear no se activa hasta tener 3 respuestas
  await expect(page.getByText('La entrevista')).toBeVisible();
  const crear = page.getByRole('button', { name: 'Crear mi personaje' });
  await expect(crear).toBeDisabled();
  await page.getByRole('button', { name: /No sé qué poner/ }).click();
  await page.getByPlaceholder('Backend, Product Owner, Señor de los Excels…').fill('Desarrollador full stack');
  await page.screenshot({ path: `${SHOTS}/2-entrevista.png`, fullPage: true });
  await crear.click();

  // Ficha generada por la IA, editable
  await expect(page.getByText('Tu personaje')).toBeVisible({ timeout: 120000 });
  await page.screenshot({ path: `${SHOTS}/3-ficha.png`, fullPage: true });
  await page.getByRole('button', { name: /Que viva/ }).click();

  // La oficina
  await expect(page.getByText('Radio pasillo')).toBeVisible();
  await expect(page.getByText('El sueño de esta noche')).toBeVisible();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SHOTS}/4-oficina.png` });
});
