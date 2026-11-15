// El dueño repite las escenas de transformación y «¡Contratado!» desde 🧪 Pruebas, sin IA ni
// despertador. Va la primera (0-) porque el dueño es el primero que se registra en la base vacía
// y se queda la empresa 1. Pila de pruebas con ALLOW_REGISTRATION=true; nunca la oficina real.

const { test, expect } = require('@playwright/test');

test('el dueño repite sus escenas desde el modo pruebas', async ({ page, request }) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const reg = await request.post('/api/auth/register', { data: { email: `duena-${Date.now()}@madoffice.test`, name: 'Dueña' } });
  expect(reg.status(), await reg.text()).toBe(201);
  const { token, user } = await reg.json();
  expect(user.is_admin).toBe(true);
  const H = { Authorization: `Bearer ${token}` };
  const base = '/api/companies/1';

  // Personaje con respuestas (montaña y café → sus motivos) y ficha aprobada, por API.
  const org = await (await request.get(`${base}/org`, { headers: H })).json();
  const ceo = org.positions.find(p => p.title === 'CEO');
  expect((await request.post(`${base}/me/position`, { headers: H, data: { position_id: ceo.id } })).ok()).toBeTruthy();
  await request.post(`${base}/me/interview`, { headers: H, data: { answers: { a: 'La montaña', b: 'Café solo', c: 'Programar' } } });
  const ficha = { puesto: 'CEO', personalidad: 'Manda con cariño.', manias: ['Uno', 'Dos', 'Tres'], objetivo: 'Probar', muletillas: ['Vale.', 'Venga.', 'Hecho.'] };
  expect((await request.put(`${base}/me/ficha`, { headers: H, data: { ficha, approve: true } })).ok()).toBeTruthy();

  await page.addInitScript(([t]) => { localStorage.setItem('mad_office_token', t); }, [token]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Guardar' }).click();
  const entrar = page.getByRole('button', { name: 'Entrar' }).first();
  if (await entrar.isVisible().catch(() => false)) await entrar.click();
  await page.getByRole('button', { name: 'Pruebas', exact: true }).click();
  await page.getByRole('button', { name: /Transformación/ }).click();
  await expect(page.getByText('Transformación en curso')).toBeVisible();
  await expect(page.locator('.transfo-caption', { hasText: /montaña|Café|Programar/ })).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/escena-transfo.png' });
  await expect(page.getByText('¡Transformación completa!')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: '¡Contratado!' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/CEO/).last()).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'test-results/escena-contrato.png' });
  await page.getByRole('button', { name: /A la oficina/ }).click();
  await expect(page.getByText('🧪 Modo pruebas')).toBeVisible();
  expect(errors).toEqual([]);
});
