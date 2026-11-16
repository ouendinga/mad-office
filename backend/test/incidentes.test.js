// Incidentes y eventos: reglas, probabilidades y efectos (sin base de datos).
const test = require('node:test');
const assert = require('node:assert/strict');
const inc = require('../src/world/incidents');
const ev = require('../src/world/events');
const places = require('../src/world/places');
const { spreadZones } = require('../src/world/sim');
const { DEFAULT } = require('../src/world/clock');

const people = n => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `P${i + 1}`, ficha: {} }));
const ctxFor = (over = {}) => {
  const chars = people(10);
  return {
    companyId: 1, day: '2026-11-16', min: 600, mapTypes: new Set(places.INCIDENT_OBJECTS), active: [],
    lunch: false, windy: false, storm: false, hot: false, startedToday: 0,
    inPlace: () => chars, ...over,
  };
};
// Tira los dados durante muchos minutos y cuenta lo que sale.
function simulate(over, minutes = 6000) {
  const count = {};
  for (let m = 0; m < minutes; m++) {
    for (const n of inc.roll(ctxFor({ min: m, day: `2026-11-${10 + Math.floor(m / 600)}`, ...over }))) count[n.def.kind] = (count[n.def.kind] || 0) + 1;
  }
  return count;
}

test('los objetos de los que dependen los incidentes están en el mapa', () => {
  const map = require('../../frontend/src/assets/maps/office.json');
  const types = new Set(map.objects.map(o => o.type));
  for (const t of places.INCIDENT_OBJECTS) assert.ok(types.has(t), `falta ${t} en el mapa`);
  for (const d of inc.CATALOG) for (const t of d.needs) assert.ok(places.INCIDENT_OBJECTS.includes(t), `${d.kind} necesita ${t}`);
});

test('sin el objeto, no pasa: sin máquina de snacks no se rompe la máquina', () => {
  const types = new Set(places.INCIDENT_OBJECTS.filter(t => t !== 'vending'));
  assert.equal(simulate({ mapTypes: types }).maquina_rota, undefined);
});

test('unos incidentes son más probables que otros (impresora mucho más que inundación)', () => {
  const c = simulate({});
  assert.ok((c.impresora_atasco || 0) > (c.bano_inundado || 0) * 3, JSON.stringify(c));
});

test('el viento se lleva los pósits mucho más a menudo cuando hace viento', () => {
  assert.ok((simulate({ windy: true }).postits_viento || 0) > (simulate({}).postits_viento || 0) * 4);
});

test('el olor del micro solo lo provoca quien cocina fatal, en la cocina, a la hora de comer', () => {
  const cooks = people(10).filter(c => inc.traits(c).cocinaMal);
  assert.ok(cooks.length > 0, 'nadie cocina fatal');
  const lunch = simulate({ lunch: true, inPlace: () => cooks }, 600);
  assert.ok((lunch.olor_micro || 0) > 0);
  const nobody = simulate({ lunch: true, inPlace: () => [] }, 600);
  assert.equal(nobody.olor_micro, undefined);
});

test('como mucho 3 incidentes al día y nunca dos iguales a la vez', () => {
  assert.equal(inc.roll(ctxFor({ startedToday: inc.MAX_PER_DAY })).length, 0);
  const active = [{ kind: 'impresora_atasco' }];
  for (let m = 0; m < 3000; m++) assert.ok(!inc.roll(ctxFor({ min: m, active })).some(n => n.def.kind === 'impresora_atasco'));
});

test('efectos: el baño inundado cierra; el olor hace huir de la cocina; sin máquina no hay snacks', () => {
  const e = inc.effects([{ kind: 'bano_inundado', place: 'lavabo' }, { kind: 'olor_micro', place: 'cafe' }, { kind: 'maquina_rota', place: 'cafe' }]);
  assert.ok(e.closed.has('lavabo') && e.avoid.has('cafe') && e.noSnack && !e.apagon);
  const view = [{ id: 1, mode: 'oficina', lugar: 'lavabo', desk_index: 0 }];
  spreadZones(view, { closed: e.closed });
  assert.equal(view[0].lugar, 'mesa');
  assert.match(view[0].que, /cerrado/);
});

test('eventos automáticos: afterwork los viernes, team building el último jueves, un cumple al año por persona', () => {
  const sch = DEFAULT;
  assert.ok(ev.autoEvents('2026-11-20', 5, [], sch, 1).some(e => e.kind === 'afterwork'));
  assert.ok(!ev.autoEvents('2026-11-19', 4, [], sch, 1).some(e => e.kind === 'afterwork'));
  assert.ok(ev.autoEvents('2026-11-26', 4, [], sch, 1).some(e => e.kind === 'teambuilding'));
  assert.ok(!ev.autoEvents('2026-11-12', 4, [], sch, 1).some(e => e.kind === 'teambuilding'));
  // Cumples: a lo largo de un año, cada persona tiene el suyo (entre semana o el viernes de antes).
  const chars = people(5);
  const seen = {};
  for (let i = 0; i < 365; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + i));
    const wd = d.getUTCDay() || 7;
    if (wd > 5) continue;
    for (const e of ev.autoEvents(d.toISOString().slice(0, 10), wd, chars, sch, 1)) if (e.kind === 'cumple') seen[e.forId] = (seen[e.forId] || 0) + 1;
  }
  for (const c of chars) assert.equal(seen[c.id], 1, `${c.name}: ${seen[c.id]} cumples`);
});

test('ir a un evento: según el carácter, siempre igual, y al cumple propio se va siempre', () => {
  const e = { id: 7, kind: 'afterwork' };
  const chars = people(40);
  const goers = chars.filter(c => ev.attends(c, e, { social: 3 }));
  assert.ok(goers.length > 10 && goers.length < 40);
  assert.deepEqual(goers, chars.filter(c => ev.attends(c, e, { social: 3 })));
  assert.ok(ev.attends(chars[0], { id: 8, kind: 'cumple', forId: chars[0].id }));
  const sociable = chars.filter(c => ev.attends(c, e, { social: 5 })).length;
  const huraño = chars.filter(c => ev.attends(c, e, { social: 0.5 })).length;
  assert.ok(sociable > huraño);
});

test('con lluvia o frío, lo de la terraza se hace dentro', () => {
  assert.equal(ev.placeFor({ place: 'terraza' }, { code: 61, temp: 15 }), 'descanso');
  assert.equal(ev.placeFor({ place: 'terraza' }, { code: 0, temp: 20 }), 'terraza');
  assert.equal(ev.placeFor({ place: 'reuniones' }, { code: 61, temp: 2 }), 'reuniones');
});

test('cada incidente tiene texto, reacciones y arreglo, y los textos no se repiten siempre', () => {
  const kinds = new Set();
  for (const d of inc.CATALOG) {
    assert.ok(!kinds.has(d.kind), `repetido: ${d.kind}`);
    kinds.add(d.kind);
    assert.ok(d.react.length >= 2, `${d.kind}: pocas reacciones`);
    assert.equal(typeof d.title({ name: 'Ana' }, { name: 'Luis' }), 'string');
    assert.equal(typeof d.fixed({ name: 'Ana' }, { name: 'Luis' }), 'string');
    assert.ok(['tiempo', 'alguien', 'tecnico'].includes(d.repair));
    if (d.repair === 'tiempo') assert.ok(d.duration, `${d.kind}: se pasa solo pero sin duración`);
  }
  assert.ok(inc.CATALOG.length >= 20);
  const titles = new Set(Array.from({ length: 40 }, () => inc.BY_KIND.impresora_atasco.title({ name: 'Ana' })));
  assert.ok(titles.size >= 2, 'el atasco siempre igual');
});
