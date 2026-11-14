// Empresas, invitaciones, organigrama, peticiones de cargo, carga de trabajo y tablón.
// Por API. Necesita una pila de pruebas con ALLOW_REGISTRATION=true y un despertador --fake
// (para las ofertas del tablón). No se pasa contra la oficina de verdad.

const { test, expect } = require('@playwright/test');

const stamp = Date.now();
const FICHA = {
  puesto: 'Probador', personalidad: 'Prueba cosas con mucho cariño.', manias: ['Probar', 'Volver a probar', 'Apuntarlo'],
  objetivo: 'Que todo pase en verde', muletillas: ['Probado.', 'En verde.', 'Otra vez.'],
};

async function signup(request, name, extra = {}) {
  const r = await request.post('/api/auth/register', { data: { email: `${name}-${stamp}@madoffice.test`, name, ...extra } });
  expect(r.status(), await r.text()).toBe(201);
  const { token } = await r.json();
  return { Authorization: `Bearer ${token}` };
}

const json = async r => { expect(r.ok(), `${r.status()} ${await r.text()}`).toBeTruthy(); return r.json(); };

test('empresas de punta a punta', async ({ request }) => {
  test.setTimeout(120000);
  // A crea su empresa (es su admin) y aparece en «mis empresas».
  const A = await signup(request, 'ana');
  const co = await json(await request.post('/api/companies', { headers: A, data: { name: `Pruebas ${stamp}`, visibility: 'privada' } }));
  const me = await json(await request.get('/api/me', { headers: A }));
  expect(me.companies.find(c => c.id === co.id).role).toBe('admin');
  const base = `/api/companies/${co.id}`;

  // El organigrama viene sembrado y con ficticios en sus huecos.
  let orgData = await json(await request.get(`${base}/org`, { headers: A }));
  const ceo = orgData.positions.find(p => p.title === 'CEO');
  const dev = orgData.positions.find(p => p.title === 'Desarrollo');
  expect(ceo.holders[0].human).toBe(false);

  // A se pone de CEO y aprueba su ficha: el ficticio de CEO se retira.
  await json(await request.post(`${base}/me/position`, { headers: A, data: { position_id: ceo.id } }));
  await json(await request.put(`${base}/me/ficha`, { headers: A, data: { ficha: FICHA, approve: true } }));
  orgData = await json(await request.get(`${base}/org`, { headers: A }));
  expect(orgData.positions.find(p => p.id === ceo.id).holders.map(h => h.human)).toEqual([true]);

  // Empresa privada: sin invitación no se entra ni se ve.
  const C = await signup(request, 'carla');
  expect((await request.get(base, { headers: C })).status()).toBe(404);
  expect((await request.post(`${base}/join`, { headers: C, data: {} })).status()).toBe(404);

  // B entra por invitación al registrarse.
  const inv = await json(await request.post(`${base}/invitations`, { headers: A, data: { days: 2, max_uses: 2 } }));
  expect((await json(await request.get(`/api/invitations/${inv.code}`, { headers: C }))).company.id).toBe(co.id);
  const B = await signup(request, 'bea', { invite: inv.code });
  expect((await json(await request.get('/api/me', { headers: B }))).companies.map(c => c.id)).toContain(co.id);
  // Un miembro normal no toca lo de admin.
  expect((await request.post(`${base}/invitations`, { headers: B, data: {} })).status()).toBe(403);

  // B quiere ser CEO: está ocupado por A (409); se pone en Desarrollo y se lo pide; A acepta: se intercambian.
  const taken = await request.post(`${base}/me/position`, { headers: B, data: { position_id: ceo.id } });
  expect(taken.status()).toBe(409);
  expect((await taken.json()).code).toBe('ocupado');
  await json(await request.post(`${base}/me/position`, { headers: B, data: { position_id: dev.id } }));
  await json(await request.put(`${base}/me/ficha`, { headers: B, data: { ficha: FICHA, approve: true } }));
  await json(await request.post(`${base}/org/requests`, { headers: B, data: { position_id: ceo.id } }));
  const incoming = (await json(await request.get(`${base}/org/requests`, { headers: A }))).incoming;
  expect(incoming).toHaveLength(1);
  await json(await request.post(`${base}/org/requests/${incoming[0].id}`, { headers: A, data: { accept: true } }));
  orgData = await json(await request.get(`${base}/org`, { headers: A }));
  expect(orgData.positions.find(p => p.id === ceo.id).holders.find(h => h.human).name).toBe('bea');
  expect(orgData.positions.find(p => p.id === dev.id).holders.some(h => h.name === 'ana')).toBe(true);

  // Carga de trabajo: solo el admin.
  expect((await request.put(`${base}/workload/2026-11-20`, { headers: B, data: { level: 3 } })).status()).toBe(403);
  await json(await request.put(`${base}/workload/2026-11-20`, { headers: A, data: { level: 3, note: 'Entrega al cliente' } }));

  // Pública y con tablón: C pide entrar a un cargo vacante y A le acepta.
  await json(await request.put(base, { headers: A, data: { visibility: 'publica', settings: { jobBoard: true, remotePerWeek: 1, officeDays: [2, 4] } } }));
  expect((await json(await request.get(base, { headers: A }))).settings).toEqual({ remotePerWeek: 1, officeDays: [2, 4], jobBoard: true });
  const pub = await json(await request.get('/api/public/companies', { headers: C }));
  expect(pub.some(c => c.id === co.id)).toBe(true);
  // Las ofertas las escribe la IA (aquí, el despertador de prueba).
  await expect.poll(async () => {
    const jobs = await json(await request.get('/api/jobs', { headers: C }));
    return jobs.filter(j => j.company.id === co.id && j.ad.requisitos.length > 0).length;
  }, { timeout: 60000 }).toBeGreaterThan(0);
  const jobs = await json(await request.get('/api/jobs', { headers: C }));
  expect(jobs.some(j => j.company.id === co.id && j.position.id === ceo.id)).toBe(false); // el CEO ya no está vacante
  // Como mucho 4 ofertas por empresa (rotan cada día): se postula a una de las que salen.
  const mine = jobs.filter(j => j.company.id === co.id);
  expect(mine.length).toBeLessThanOrEqual(4);
  const offer = mine[0];
  await json(await request.post(`${base}/join`, { headers: C, data: { position_id: offer.position.id, message: '¡Sé usar emojis!' } }));
  const reqs = await json(await request.get(`${base}/join-requests`, { headers: A }));
  expect(reqs[0].position).toBe(offer.position.title);
  await json(await request.post(`${base}/join-requests/${reqs[0].id}`, { headers: A, data: { accept: true } }));
  expect((await request.get(base, { headers: C })).status()).toBe(200);
});
