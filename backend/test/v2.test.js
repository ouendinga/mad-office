const test = require('node:test');
const assert = require('node:assert/strict');
const clock = require('../src/world/clock');
const gm = require('../src/world/gameMaster');
const stats = require('../src/world/stats');
const { heardBy, whereAt } = require('../src/world/hearing');
const weather = require('../src/world/weather');
const { autopilotPlan } = require('../src/world/autopilot');
const { linkCalls } = require('../src/world/sim');
const prompts = require('../src/ai/prompts');

const at = iso => clock.parts(Date.parse(iso));
const names = [{ id: 1, name: 'Álvaro' }, { id: 2, name: 'Paco' }, { id: 3, name: 'Lucía' }];

test('fases: casa, ida (08:30-09:00), oficina, vuelta (18:00-18:30) y finde', () => {
  assert.equal(clock.phaseOf(at('2026-11-16T08:29:00+01:00')), 'casa');
  assert.equal(clock.phaseOf(at('2026-11-16T08:30:00+01:00')), 'ida');
  assert.equal(clock.phaseOf(at('2026-11-16T09:00:00+01:00')), 'oficina');
  assert.equal(clock.phaseOf(at('2026-11-16T18:00:00+01:00')), 'vuelta');
  assert.equal(clock.phaseOf(at('2026-11-16T18:30:00+01:00')), 'casa');
  assert.equal(clock.phaseOf(at('2026-11-14T08:45:00+01:00')), 'casa'); // sábado
});

test('GM: piensa y externo pasan limpios; compañero y externo a la vez, gana el compañero', () => {
  const plan = gm.validatePlan([
    { hora: '09:00', lugar: 'mesa', con: '', que: 'Llama', frase: '', externo: 'un cliente de Bilbao', piensa: 'Ojalá no conteste' },
    { hora: '10:00', lugar: 'cafe', con: 'Paco', que: 'Café', frase: '', externo: 'otro', piensa: '' },
  ], { block: 'manana', names, selfId: 1 });
  assert.equal(plan[0].externo, 'un cliente de Bilbao');
  assert.equal(plan[0].piensa, 'Ojalá no conteste');
  assert.equal(plan[1].con, 2);
  assert.equal(plan[1].externo, undefined);
  assert.equal(plan[1].piensa, undefined);
});

test('GM: en remoto todo pasa en casa', () => {
  const plan = gm.validatePlan([{ hora: '10:00', lugar: 'reuniones', con: 'Paco', que: 'Videollamada', frase: '' }],
    { block: 'manana', names, selfId: 1, remote: true });
  assert.ok(plan.every(a => a.lugar === 'casa'));
  assert.equal(plan[1].con, 2);
});

test('GM: teletrabaja solo si lo pide Y las reglas lo dejan', () => {
  const base = { block: 'manana', names, selfId: 1, decideMode: true };
  assert.equal(gm.validateWake({ donde: 'casa', plan: [] }, { ...base, canRemote: true }).mode, 'remoto');
  assert.equal(gm.validateWake({ donde: 'casa', plan: [] }, { ...base, canRemote: false }).mode, 'oficina');
  assert.equal(gm.validateWake({ donde: 'oficina', plan: [] }, { ...base, canRemote: true }).mode, 'oficina');
  const v = gm.validateWake({ donde: 'oficina', trayecto: 'Se le escapa el bus\npor un pelo', plan: [] }, { ...base, canRemote: true });
  assert.equal(v.trayecto, 'Se le escapa el bus por un pelo');
  assert.equal(gm.validateWake({ donde: 'casa', trayecto: 'x', plan: [] }, { ...base, canRemote: true }).trayecto, '');
  // La tarde no decide: mantiene lo que ya había.
  assert.equal(gm.validateWake({ donde: 'oficina', plan: [] }, { block: 'tarde', names, selfId: 1, remote: true }).mode, 'remoto');
});

test('estados: siempre entre 0 y 5 con un decimal', () => {
  let s = stats.normalize({ energia: 9, animo: -3 });
  assert.equal(s.energia, 5);
  assert.equal(s.animo, 0);
  for (let i = 0; i < 40; i++) s = stats.applyAction(s, { lugar: 'reuniones', min: 600, externo: 'x' });
  for (const k of stats.KEYS) assert.ok(s[k] >= 0 && s[k] <= 5 && Math.round(s[k] * 10) === s[k] * 10, k);
});

test('estados: comer llena; reunirse estresa; la terraza con lluvia baja el ánimo', () => {
  const s0 = stats.normalize({ saciedad: 1, calma: 3, animo: 3 });
  assert.ok(stats.applyAction(s0, { lugar: 'cafe', min: 840 }).saciedad > stats.applyAction(s0, { lugar: 'cafe', min: 600 }).saciedad);
  assert.ok(stats.applyAction(s0, { lugar: 'reuniones', min: 600 }).calma < s0.calma);
  const sol = stats.applyAction(s0, { lugar: 'terraza', min: 600 }, { weather: { code: 0, temp: 20 } });
  const lluvia = stats.applyAction(s0, { lugar: 'terraza', min: 600 }, { weather: { code: 63, temp: 12 } });
  assert.ok(lluvia.animo < sol.animo);
});

test('estados: el humor de la IA tira del ánimo; por la mañana se recupera', () => {
  const s = stats.normalize({ animo: 2, energia: 1 });
  assert.ok(stats.applyHumor(s, 'euforico').animo > s.animo);
  assert.ok(stats.applyHumor(s, 'inventado').animo === s.animo);
  assert.ok(stats.morning(s).energia >= 4);
});

test('oír: solo lo del mismo sitio a la vez, lo que le dicen y nada de pensamientos ajenos', () => {
  const plan = [{ min: 540, lugar: 'mesa' }, { min: 600, lugar: 'cafe' }, { min: 660, lugar: 'mesa' }];
  assert.equal(whereAt(plan, 610), 'cafe');
  const ev = [
    { character_id: 2, lugar: 'mesa', min: 550, kind: 'accion', text: 'a' }, // open space, estaba → sí
    { character_id: 2, lugar: 'cafe', min: 550, kind: 'accion', text: 'b' }, // café, no estaba → no
    { character_id: 2, lugar: 'cafe', min: 620, kind: 'accion', text: 'c' }, // café, estaba → sí
    { character_id: 3, lugar: 'terraza', min: 620, con_id: 1, kind: 'accion', text: 'd' }, // se lo dicen a él → sí
    { character_id: 3, lugar: 'mesa', min: 700, kind: 'pensamiento', private: true, text: 'e' }, // pensamiento ajeno → no
    { character_id: 3, lugar: 'reuniones', min: 700, kind: 'llamada', text: 'f' }, // llamada ajena en otra sala → no
  ];
  assert.deepEqual(heardBy(ev, { id: 1, mode: 'oficina' }, plan).map(e => e.text), ['a', 'c', 'd']);
  // Quien teletrabaja solo se entera de lo suyo.
  assert.deepEqual(heardBy(ev, { id: 1, mode: 'remoto' }, plan).map(e => e.text), ['d']);
});

test('tiempo: códigos WMO y estaciones (también en el sur)', () => {
  assert.equal(weather.describe(0), 'despejado');
  assert.equal(weather.describe(63), 'lluvia');
  assert.equal(weather.describe(73), 'nieve');
  assert.equal(weather.describe(95), 'tormenta');
  assert.equal(weather.season('2026-11-16', 40), 'otono');
  assert.equal(weather.season('2026-01-10', 40), 'invierno');
  assert.equal(weather.season('2026-07-10', 40), 'verano');
  assert.equal(weather.season('2026-07-10', -34), 'invierno');
  assert.match(weather.promptLine({ desc: 'lluvia', temp: 9.4 }, 'otono'), /lluvia, 9 °C/);
  assert.equal(weather.promptLine(null, 'otono'), 'Estación: otono.');
});

test('piloto automático en remoto: todo en casa', () => {
  const a = autopilotPlan({ id: 1, ficha: {} }, '2026-11-16', 'manana', { remote: true });
  assert.ok(a.every(x => x.lugar === 'casa'));
});

test('llamadas: si alguien de casa llama a uno de la oficina, a los dos se les ve', () => {
  const view = [{ id: 1, home: false, call: { with: 2, externo: null } }, { id: 2, home: false, call: null }, { id: 3, home: true, call: null }];
  linkCalls(view);
  assert.deepEqual(view[1].call, { with: 1, externo: null });
});

test('prompts: el despertar pide dónde y trayecto; con tope, no ofrece teletrabajar', () => {
  const c = { id: 1, name: 'Álvaro', humor: 'normal', ficha: { puesto: 'Dev', personalidad: 'x', objetivo: 'y', muletillas: [] }, stats: stats.DEFAULT };
  const r = prompts.planRequest({ kind: 'despertar', character: c, cast: [c], day: '2026-11-16', block: 'manana', heard: ['Paco: café'], dream: null, weatherLine: 'Tiempo fuera: lluvia, 9 °C (otono).', remoteRule: 'no' });
  assert.ok(r.schema.properties.donde && r.schema.properties.trayecto && !r.schema.properties.sueno);
  assert.match(r.prompt, /le toca ir a la oficina/);
  assert.match(r.prompt, /lluvia/);
  assert.match(r.prompt, /Paco: café/);
  const r2 = prompts.planRequest({ kind: 'despertar', character: c, cast: [c], day: '2026-11-16', block: 'manana', heard: [], dream: 'algo', remoteRule: 'puede' });
  assert.ok(r2.schema.properties.sueno);
  assert.match(r2.prompt, /puede elegir teletrabajar/);
});

test('cola: el despertar pedido a las 08:30 no caduca hasta pasada la mañana', async () => {
  const turns = require('../src/ai/turns');
  const sql = [];
  const pool = { query: async (q, params) => { sql.push({ q, params }); return { rows: [] }; } };
  await turns.maintain(pool, { day: '2026-11-16', block: 'noche', minutes: 515 });
  const expire = sql.find(x => /status = 'expired'/.test(x.q) && /despertar/.test(x.q));
  // La condición depende de los parámetros: a las 08:35 (515) con bloque «noche» no caduca.
  // El límite es el inicio de la tarde del horario configurado (14:00 por defecto).
  assert.deepEqual(expire.params, ['2026-11-16', 'noche', 515, 840, null]);
  assert.match(expire.q, /\$2 = 'noche' AND \$3 >= \$4/);
});

test('horas extra: solo en la tarde, si las pide y las reglas dejan; el plan llega hasta las 19:45', () => {
  const ctx = { block: 'tarde', names, selfId: 1 };
  const plan = [{ hora: '19:30', lugar: 'mesa', con: '', que: 'Sigue', frase: '' }];
  assert.equal(gm.validateWake({ horas_extra: true, plan }, { ...ctx, canExtra: false }).extra, false);
  const v = gm.validateWake({ horas_extra: true, plan }, { ...ctx, canExtra: true });
  assert.equal(v.extra, true);
  assert.equal(v.plan[v.plan.length - 1].hora, '19:30');
  // Sin horas extra, lo de las 19:30 se recorta a la tarde normal.
  const n = gm.validateWake({ horas_extra: false, plan }, { ...ctx, canExtra: true });
  assert.equal(n.plan[n.plan.length - 1].hora, '17:45');
  // Por la mañana no se piden.
  assert.equal(gm.validateWake({ horas_extra: true, plan: [] }, { block: 'manana', names, selfId: 1, canExtra: true }).extra, false);
});

test('horas extra: fase de cada uno (oficina hasta las 20:00 y vuelta después)', () => {
  const { charPhase } = require('../src/world/sim');
  const pAt = h => at(`2026-11-16T${h}:00+01:00`);
  const d = { extra: true };
  assert.equal(charPhase(pAt('18:10'), 'vuelta', d), 'oficina');
  assert.equal(charPhase(pAt('20:10'), 'casa', d), 'vuelta');
  assert.equal(charPhase(pAt('18:10'), 'vuelta', { extra: false }), 'vuelta');
});

test('estados: las horas extra cansan', () => {
  const s0 = stats.normalize({});
  assert.ok(stats.applyAction(s0, { lugar: 'mesa', min: 1150 }).energia < stats.applyAction(s0, { lugar: 'mesa', min: 1000 }).energia);
});

test('horario: por defecto 9-18 con comida a las 14:00; se puede cambiar y todo se recalcula', () => {
  const { autopilotPlan } = require('../src/world/autopilot');
  try {
    assert.equal(clock.BLOCKS.manana.from, 540);
    assert.equal(clock.COMMUTE.ida, 510);
    // Horario de 8:00 a 17:00 con 30 min de comida a las 13:30
    assert.equal(clock.setSchedule({ start: 480, end: 1020, lunch: 810, lunchMin: 30 }), null);
    assert.equal(clock.BLOCKS.manana.to, 810);
    assert.equal(clock.BLOCKS.tarde.to, 1020);
    assert.equal(clock.BLOCKS.extra.from, 1020);
    assert.equal(clock.COMMUTE.ida, 450);
    assert.equal(clock.phaseOf(at('2026-11-16T07:45:00+01:00')), 'ida');
    assert.equal(clock.blockOf(at('2026-11-16T08:05:00+01:00')), 'manana');
    const m = autopilotPlan({ id: 1, ficha: {} }, '2026-11-16', 'manana');
    const t = autopilotPlan({ id: 1, ficha: {} }, '2026-11-16', 'tarde');
    assert.equal(m[0].min, 480);
    assert.equal(t[0].min, 810); // la comida, al empezar la tarde
    assert.ok([...m].every(a => a.min >= 480 && a.min < 810));
    assert.ok(t.every(a => a.min >= 810 && a.min < 1020));
    // Horarios imposibles se rechazan sin tocar nada
    assert.match(clock.setSchedule({ start: 480, end: 600, lunch: 540, lunchMin: 30 }), /4 horas/);
    assert.match(clock.setSchedule({ start: 480, end: 1020, lunch: 490, lunchMin: 30 }), /comida/);
    assert.equal(clock.BLOCKS.manana.from, 480);
  } finally {
    clock.setSchedule({ start: 540, end: 1080, lunch: 840, lunchMin: 60 });
  }
});

test('GM: como mucho dos pensamientos por bloque', () => {
  const raw = ['09:00', '10:00', '11:00', '12:00'].map(h => ({ hora: h, lugar: 'mesa', con: '', que: 'x', frase: '', piensa: `p${h}` }));
  const plan = gm.validatePlan(raw, { block: 'manana', names, selfId: 1 });
  assert.equal(plan.filter(a => a.piensa).length, 2);
});

test('visitantes: deterministas por día, dentro de la jornada, y la limpieza siempre', () => {
  const { visitorsFor } = require('../src/world/visitors');
  const chars = [{ id: 1, name: 'Ana' }, { id: 2, name: 'Bea' }];
  const a = visitorsFor('2026-11-16', 1, clock.DEFAULT, chars);
  assert.deepEqual(a, visitorsFor('2026-11-16', 1, clock.DEFAULT, chars));
  assert.ok(a.some(v => v.kind === 'limpieza'));
  for (const v of a) {
    assert.ok(v.from >= clock.BLOCKS.manana.from && v.to <= clock.BLOCKS.extra.to, v.kind);
    if (v.kind === 'repartidor') assert.ok([1, 2].includes(v.forId));
  }
  // A lo largo de un mes, a veces hay repartidor y a veces no.
  const days = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
  const withParcel = days.filter(d => visitorsFor(d, 1, clock.DEFAULT, chars).some(v => v.kind === 'repartidor')).length;
  assert.ok(withParcel > 5 && withParcel < 28, String(withParcel));
});

test('prompt: con mucha gente, solo los C-suite, su equipo y poco más (tope)', () => {
  const { Sim } = require('../src/world/sim');
  const me = { id: 1, position_id: 10, position_parent: 5 };
  const cast = [me,
    { id: 2, csuite: true },
    { id: 3, position_id: 5 }, // su jefe
    { id: 4, position_parent: 5 }, // compañero de equipo
    { id: 5, position_parent: 10 }, // subordinado
    ...Array.from({ length: 40 }, (_, i) => ({ id: 100 + i, position_parent: 99 })),
  ];
  const out = Sim.prototype.relevantCast.call({}, me, cast);
  assert.ok(out.length <= 13);
  for (const id of [1, 2, 3, 4, 5]) assert.ok(out.some(x => x.id === id), String(id));
});
