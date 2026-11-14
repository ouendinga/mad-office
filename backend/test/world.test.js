const test = require('node:test');
const assert = require('node:assert/strict');
const clock = require('../src/world/clock');
const gm = require('../src/world/gameMaster');
const { autopilotPlan } = require('../src/world/autopilot');
const { PLACES } = require('../src/world/places');

const at = iso => clock.parts(Date.parse(iso));

test('bloques del día en hora de Madrid', () => {
  assert.equal(clock.blockOf(at('2026-11-11T08:59:00+01:00')), 'noche');
  assert.equal(clock.blockOf(at('2026-11-11T09:00:00+01:00')), 'manana');
  assert.equal(clock.blockOf(at('2026-11-11T13:59:00+01:00')), 'manana');
  assert.equal(clock.blockOf(at('2026-11-11T14:00:00+01:00')), 'tarde');
  assert.equal(clock.blockOf(at('2026-11-11T18:00:00+01:00')), 'noche');
  // UTC 08:30 = 09:30 en Madrid en invierno
  assert.equal(clock.blockOf(at('2026-11-11T08:30:00Z')), 'manana');
});

test('el fin de semana es noche entera', () => {
  assert.equal(clock.blockOf(at('2026-11-14T11:00:00+01:00')), 'noche'); // sábado
});

test('la ventana del sueño: de 18:00 a 09:00 y el fin de semana', () => {
  assert.equal(clock.dreamWindowOpen(at('2026-11-11T12:00:00+01:00')), false);
  assert.equal(clock.dreamWindowOpen(at('2026-11-11T22:00:00+01:00')), true);
  assert.equal(clock.dreamWindowOpen(at('2026-11-12T07:00:00+01:00')), true);
});

test('el sueño va a la siguiente mañana laborable', () => {
  assert.equal(clock.nextMorning(at('2026-11-11T22:00:00+01:00')), '2026-11-12'); // miércoles noche → jueves
  assert.equal(clock.nextMorning(at('2026-11-12T07:00:00+01:00')), '2026-11-12'); // jueves madrugada → jueves
  assert.equal(clock.nextMorning(at('2026-11-13T19:00:00+01:00')), '2026-11-16'); // viernes → lunes
  assert.equal(clock.nextMorning(at('2026-11-15T10:00:00+01:00')), '2026-11-16'); // domingo → lunes
});

test('el reloj acelerado avanza a su velocidad', () => {
  let real = 1000;
  const c = clock.makeClock({ speed: 60, start: 0, now: () => real });
  real += 1000;
  assert.equal(c.nowMs(), 60000);
});

const names = [{ id: 1, name: 'Álvaro' }, { id: 2, name: 'Paco' }, { id: 3, name: 'Lucía' }];

test('GM: ordena, recorta al bloque, quita lugares inventados y resuelve compañeros', () => {
  const plan = gm.validatePlan([
    { hora: '12:00', lugar: 'cafe', con: 'paco', que: 'Café', frase: 'Hola' },
    { hora: '07:00', lugar: 'luna', con: '', que: 'Llega', frase: '' },
    { hora: '23:00', lugar: 'mesa', con: 'Lucia', que: 'Visita', frase: '' },
    { hora: 'mañana', lugar: 'mesa', con: '', que: 'Nada', frase: '' },
    { hora: '10:00', lugar: 'mesa', con: 'Álvaro', que: 'Consigo mismo', frase: '' },
  ], { block: 'manana', names, selfId: 1 });
  assert.deepEqual(plan.map(a => a.hora), ['09:00', '10:00', '12:00', '13:45']);
  assert.equal(plan[0].lugar, 'mesa'); // lugar inventado → mesa
  assert.equal(plan[1].con, null); // no puede quedar consigo mismo
  assert.equal(plan[2].con, 2); // "paco" → Paco
  assert.equal(plan[3].con, 3); // "Lucia" sin tilde → Lucía
});

test('GM: con varios compañeros vale el primero', () => {
  assert.equal(gm.resolveCompanion('Paco, Lucía y Toni', names, 1), 2);
  assert.equal(gm.resolveCompanion('Lucía y Paco', names, 1), 3);
});

test('GM: un plan vacío o basura deja al menos la llegada', () => {
  const plan = gm.validatePlan('esto no es un plan', { block: 'tarde', names, selfId: 1 });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].hora, '14:00');
});

test('GM: máximo de acciones y textos recortados sin saltos de línea', () => {
  const raw = Array.from({ length: 20 }, (_, i) => ({
    hora: `09:${String(i * 2).padStart(2, '0')}`, lugar: 'mesa', con: '', que: 'x'.repeat(300), frase: 'a\nb',
  }));
  const plan = gm.validatePlan(raw, { block: 'manana', names, selfId: 1 });
  assert.ok(plan.length <= gm.MAX_ACTIONS + 1);
  assert.ok(plan.every(a => a.que.length <= 90));
  assert.equal(plan[0].frase, 'a b');
});

test('GM: humor desconocido → normal; sueño sin forma → null', () => {
  const v = gm.validateWake({ humor: 'EUFÓRICO', plan: [], sueno: 'sí' }, { block: 'manana', names, selfId: 1 });
  assert.equal(v.humor, 'euforico');
  assert.equal(v.sueno, null);
  assert.equal(gm.validateWake({ humor: 'zen' }, { block: 'manana', names, selfId: 1 }).humor, 'normal');
});

test('GM: ficha incompleta se rechaza', () => {
  assert.throws(() => gm.validateProfile({ puesto: 'Dev' }));
  const f = gm.validateProfile({ puesto: 'Dev', personalidad: 'Majo', manias: ['a', 'b', 'c', 'd'], objetivo: 'Café', muletillas: ['x', 'y', 'z'] });
  assert.equal(f.manias.length, 3);
});

test('piloto automático: determinista, dentro del bloque y con lugares válidos', () => {
  const c = { id: 7, ficha: { muletillas: ['¡Al lío!'] } };
  const a = autopilotPlan(c, '2026-11-12', 'manana');
  assert.deepEqual(a, autopilotPlan(c, '2026-11-12', 'manana'));
  assert.equal(a[0].hora, '09:00');
  for (const x of [...a, ...autopilotPlan(c, '2026-11-12', 'tarde')]) {
    assert.ok(PLACES.includes(x.lugar));
  }
  assert.ok(autopilotPlan(c, '2026-11-12', 'tarde').every(x => x.min >= 840 - 10 && x.min < 1080));
});
