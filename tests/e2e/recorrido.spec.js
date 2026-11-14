// Recorrido completo de una persona nueva: entrar → avatar → crear su empresa → elegir cargo en
// el organigrama → entrevista → ficha → oficina. Necesita la pila levantada con
// ALLOW_REGISTRATION=true y un despertador corriendo (con --fake para no gastar).

const { test, expect } = require('@playwright/test');

const SHOTS = process.env.SHOTS_DIR || 'test-results';

test('una persona nueva monta su empresa y tiene personaje en menos de 5 minutos', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const email = `prueba-${Date.now()}@madoffice.test`;

  await page.goto('/');
  await expect(page.getByText('La oficina donde tu personaje vive solo')).toBeVisible();
  await page.getByRole('button', { name: 'Crear cuenta' }).first().click();
  await page.getByPlaceholder('tu@email.com').fill(email);
  await page.getByPlaceholder('Tu nombre').fill('Álvaro');
  await page.locator('form').getByRole('button', { name: 'Crear cuenta' }).click();

  // Avatar (una vez por persona)
  await expect(page.getByText('Así te verán en la oficina')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/1-avatar.png` });
  await page.getByRole('button', { name: 'Guardar' }).click();

  // Sin empresas: directo a crear la suya
  await expect(page.getByLabel('Nombre de la empresa')).toBeVisible();
  await page.getByLabel('Nombre de la empresa').fill('Pruebas Recorrido');
  await page.getByRole('button', { name: 'Crear empresa' }).click();

  // Elegir cargo en el organigrama
  await expect(page.getByText('¿Qué eres en esta empresa?')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/2-cargo.png`, fullPage: true });
  await page.locator('.org-card', { hasText: 'Desarrollo' }).getByRole('button', { name: 'Quiero este' }).click();

  // Entrevista: el botón de crear no se activa hasta tener 3 respuestas
  await expect(page.getByText('La entrevista')).toBeVisible();
  const crear = page.getByRole('button', { name: 'Crear mi personaje' });
  await expect(crear).toBeDisabled();
  await page.getByRole('button', { name: /No sé qué poner/ }).click();
  await page.getByPlaceholder('Operaciones, Sistemas, Account manager, Finanzas, Recepción…').fill('Account manager');
  await crear.click();

  // La transformación mientras la IA escribe la ficha, y luego la ficha editable
  await expect(page.getByText('Transformación en curso')).toBeVisible();
  await expect(page.getByText('Tu personaje')).toBeVisible({ timeout: 120000 });
  await page.getByRole('button', { name: /Que viva/ }).click();

  // ¡Contratado! (la noticia le llega a casa) y a la oficina
  await expect(page.getByRole('heading', { name: '¡Contratado!' })).toBeVisible();
  await page.getByRole('button', { name: /A la oficina/ }).click({ timeout: 15000 });

  // La oficina de SU empresa
  await expect(page.getByText('Todo lo que pasa')).toBeVisible();
  await expect(page.getByText('Pruebas Recorrido')).toBeVisible();
  await expect(page.getByText('El sueño de esta noche')).toBeVisible();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SHOTS}/4-oficina.png` });
  expect(errors).toEqual([]);
});
