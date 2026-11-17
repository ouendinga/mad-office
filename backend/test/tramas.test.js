// Tramas (world/tramas.js): que cada historia acabe, que se ramifique según quién está y cómo se
// llevan (efecto mariposa), y que deje rastro en las relaciones.
const test = require('node:test');
const assert = require('node:assert');
const tramas = require('../src/world/tramas');
const { lunchGroups } = require('../src/world/lunch');

const people = [
  { id: 1, name: 'Ana', ficha: {}, position_id: 10, csuite: true },
  { id: 2, name: 'Bea', ficha: { personalidad: 'borde y con mala leche' }, position_id: 11, position_parent: 10 },
  { id: 3, name: 'Carlos', ficha: { personalidad: 'torpe y despistado' }, position_id: 11, position_parent: 10 },
  { id: 4, name: 'Dani', ficha: {}, position_id: 11, position_parent: 10 },
  { id: 5, name: 'Eva', ficha: {}, position_id: 11, position_parent: 10 },
];
const ALL_TYPES = new Set(['kanban', 'fridge', 'pingpong', 'ac_unit']);

// Una oficina de mentira: quién está, dónde y cómo se llevan.
function ctx(seed, { absent = [], rels = new Map(), lugar = 'mesa' } = {}) {
  const r = tramas.rng(seed);
  const here = people.filter(p => !absent.includes(p.id));
  return {
    r, day: '2026-11-26', min: 600, here,
    byId: id => people.find(p => p.id === id) || null,
    present: c => !!c && here.some(p => p.id === c.id),
    where: () => lugar,
    inRoom: (c) => here.filter(o => o.id !== c.id),
    traits: c => ({ malaLeche: /mala leche/.test(JSON.stringify(c.ficha || {})), torpe: /torpe/.test(JSON.stringify(c.ficha || {})), manitas: false, cocinaMal: false }),
    rel: (a, b) => rels.get(tramas.relKey(a.id, b.id)) || { roce: 0, aprecio: 0 },
    worstPair: () => null,
    boss: c => people.find(o => c.position_parent && o.position_id === c.position_parent) || null,
    isBoss: c => !!c.csuite,
    mapTypes: ALL_TYPES, lunch: true, cold: false, hot: false,
  };
}

// Corre una trama entera, paso a paso, como lo hace officeLife. Devuelve lo que ha pasado.
function play(kind, cast, seed, opts = {}) {
  const def = tramas.PLOTS[kind];
  const rels = opts.rels || new Map();
  let row = { kind, step: def.first, ids: Object.fromEntries(Object.entries(cast).map(([k, c]) => [k, c.id])), state: def.init ? def.init(ctx(seed)) : {}, waits: 0 };
  const lines = [];
  const extra = { incidents: [], spawns: [], scenes: 0 };
  for (let i = 0; i < 40; i++) {
    const x = ctx(`${seed}|${i}`, { ...opts, rels });
    const c = Object.fromEntries(Object.entries(row.ids).map(([k, id]) => [k, x.byId(id)]));
    const b = tramas.runStep({ ...row, c, cast: c }, x);
    if (b.wait) {
      row.waits++;
      if (row.waits >= tramas.MAX_WAITS) return { outcome: 'se_olvida', lines, rels, ...extra };
      continue;
    }
    if (b.line) lines.push(b.line);
    if (b.incident) extra.incidents.push(b.incident.kind);
    if (b.spawn) extra.spawns.push(b.spawn.kind);
    extra.scenes += (b.scenes || []).length;
    tramas.applyRel(rels, b.rel);
    if (b.cast) row.ids = { ...row.ids, ...Object.fromEntries(Object.entries(b.cast).map(([k, v]) => [k, v.id])) };
    if (b.state) row.state = { ...row.state, ...b.state };
    if (b.end || !b.next) return { outcome: b.end || 'fin', lines, rels, ...extra };
    row = { ...row, step: b.next[0], waits: 0 };
  }
  throw new Error(`${kind} no acaba nunca`);
}

const castFor = (kind, seed) => {
  const def = tramas.PLOTS[kind];
  const x = ctx(seed);
  if (def.when && def.when(x)) return def.when(ctx(seed));
  // Las que no empiezan solas (salen de un incidente): un reparto al azar.
  const mix = people.slice().sort(() => x.r() - 0.5);
  return Object.fromEntries(def.roles.map((role, i) => [role, mix[i]]));
};

test('tramas: todas acaban, con frases completas y sin huecos', () => {
  for (const kind of Object.keys(tramas.PLOTS)) {
    for (let i = 0; i < 60; i++) {
      const res = play(kind, castFor(kind, `c${i}`), `${kind}|${i}`);
      assert.ok(res.lines.length >= 1, `${kind} no cuenta nada`);
      for (const l of res.lines) assert.ok(!/undefined|null|\{|NaN/.test(l), `${kind}: ${l}`);
    }
  }
});

test('tramas: se ramifican (no acaban siempre igual)', () => {
  for (const kind of ['guerra_postits', 'taper_misterioso', 'apuesta_pingpong', 'rumor', 'termostato', 'excursion_bar', 'nota_micro']) {
    const outcomes = new Set();
    for (let i = 0; i < 120; i++) outcomes.add(play(kind, castFor(kind, `r${i}`), `ram|${kind}|${i}`).outcome);
    assert.ok(outcomes.size >= 2, `${kind} acaba siempre en ${[...outcomes]}`);
  }
});

test('tramas: efecto mariposa — sin testigo en la cocina, culpan al que no era y el rencor se queda', () => {
  let inocentes = 0;
  for (let i = 0; i < 80; i++) {
    const res = play('guerra_postits', { atacante: people[1], victima: people[3] }, `mar|${i}`);
    const l = res.lines.find(t => t.includes('está convencido de que la taza'));
    if (l) {
      inocentes++;
      // El inocente acaba con roce (de ida y vuelta) sin haber hecho nada.
      const who = people.find(p => l.includes(`la escondió ${p.name}.`));
      assert.ok(who, l);
      assert.ok((res.rels.get(`${who.id}>${l.startsWith('🤨 ') ? people.find(p => l.startsWith(`🤨 ${p.name} `)).id : 0}`) || {}).roce > 0, `sin rencor del inocente: ${l}`);
    }
  }
  assert.ok(inocentes > 0, 'nunca se equivocan de culpable');
});

test('tramas: dejan roces y simpatías, y la guerra puede romper el aire o arrancar otra trama', () => {
  let incidente = 0;
  let encadena = 0;
  let relaciones = 0;
  for (let i = 0; i < 100; i++) {
    const t = play('termostato', castFor('termostato', `t${i}`), `t|${i}`);
    if (t.incidents.includes('aire_roto')) incidente++;
    const k = play('taper_misterioso', castFor('taper_misterioso', `k${i}`), `k|${i}`);
    if (k.spawns.includes('guerra_postits')) encadena++;
    if (k.rels.size) relaciones++;
  }
  assert.ok(incidente > 0, 'la guerra del termostato nunca rompe el aire');
  assert.ok(encadena > 0, 'el táper nunca acaba en guerra');
  assert.ok(relaciones > 50, 'casi nunca cambia cómo se llevan');
});

test('tramas: si falta alguien del reparto, se espera y, si no vuelve, se olvida', () => {
  const res = play('apuesta_pingpong', { retador: people[1], rival: people[2] }, 'ausente', { absent: [2, 3] });
  assert.equal(res.outcome, 'se_olvida');
  assert.equal(res.lines.length, 0);
});

test('tramas: algunos incidentes arrancan una trama; otros no', () => {
  let n = 0;
  for (let i = 0; i < 50; i++) {
    const x = ctx(`inc${i}`);
    const spec = tramas.fromIncident({ kind: 'postits_movidos', cause: people[1], victim: people[2] }, x, []);
    if (spec) { n++; assert.equal(spec.kind, 'guerra_postits'); assert.equal(spec.cast.atacante.id, 2); }
  }
  assert.ok(n > 20 && n < 50, `postits_movidos → guerra: ${n}/50`);
  assert.equal(tramas.fromIncident({ kind: 'mosca', cause: people[1] }, ctx('m'), []), null);
  // Con el cupo lleno, nada nuevo.
  const full = Array.from({ length: tramas.MAX_ACTIVE }, (_, i) => ({ kind: `x${i}` }));
  assert.equal(tramas.fromIncident({ kind: 'postits_movidos', cause: people[1], victim: people[2] }, ctx('f'), full), null);
});

test('tramas: empiezan solas, pocas y sin repetir la que ya está en marcha', () => {
  const kinds = new Map();
  let started = 0;
  for (let i = 0; i < 20000; i++) {
    const s = tramas.maybeStart(ctx(`s${i}`), { active: [{ kind: 'rumor' }], startedToday: 0, minute: 600 });
    if (s) { started++; kinds.set(s.kind, (kinds.get(s.kind) || 0) + 1); }
  }
  // Probabilidad por minuto ≈ START_PER_HOUR / 60.
  const expected = 20000 * tramas.START_PER_HOUR / 60;
  assert.ok(started > expected * 0.5 && started < expected * 1.6, `${started} vs ${expected}`);
  assert.ok(!kinds.has('rumor'), 'repite una trama en marcha');
  assert.ok(!kinds.has('excursion_bar'), 'la excursión solo sale de la cafetera rota');
  assert.equal(tramas.maybeStart(ctx('x'), { active: [], startedToday: tramas.MAX_NEW_PER_DAY, minute: 600 }), null);
});

test('relaciones: se acotan entre 0 y 1, se olvidan y cambian con quién comes', () => {
  const rels = new Map();
  tramas.applyRel(rels, [[people[1], people[2], 2, 0], [people[1], people[1], 1, 1]]);
  assert.deepEqual(rels.get('2>3'), { roce: 1, aprecio: 0 });
  assert.equal(rels.size, 1, 'nadie se tiene manía a sí mismo');
  assert.deepEqual(tramas.decay({ roce: 1, aprecio: 1 }), { roce: 0.9, aprecio: 0.95 });
  // Dos que se adoran comen juntos más a menudo que dos que se odian.
  const love = new Map();
  tramas.applyRel(love, [[people[1], people[2], 0, 1], [people[2], people[1], 0, 1]]);
  const hate = new Map();
  tramas.applyRel(hate, [[people[1], people[2], 1, 0], [people[2], people[1], 1, 0]]);
  const together = (rel) => {
    let n = 0;
    for (let d = 1; d <= 60; d++) {
      const g = lunchGroups(people, `2026-10-${String((d % 28) + 1).padStart(2, '0')}|${d}`, 1, (a, b) => tramas.bond(rel, a, b));
      if ((g.get(2).con || []).includes(3)) n++;
    }
    return n;
  };
  assert.ok(together(love) > together(hate), 'las relaciones no cambian las comidas');
});
