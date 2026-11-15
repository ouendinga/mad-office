// Ritmo de la oficina: planes del piloto automático distintos por persona y escapadas cortas.
const test = require('node:test');
const assert = require('node:assert/strict');
const { autopilotPlan } = require('../src/world/autopilot');
const micro = require('../src/world/micro');
const places = require('../src/world/places');
const { DEFAULT } = require('../src/world/clock');

const DAY = '2026-11-16';
const who = (id, extra = {}) => ({ id, desk_index: id, ficha: { muletillas: ['Vale.'] }, ...extra });

test('los planes del piloto automático no son iguales para todos', () => {
  const firsts = new Set();
  for (let id = 1; id <= 12; id++) {
    const plan = autopilotPlan(who(id), DAY, 'manana');
    firsts.add(plan.find(a => a.lugar !== 'mesa')?.min);
  }
  assert.ok(firsts.size >= 6, `la primera salida de 12 personas cae en solo ${firsts.size} horas distintas`);
});

test('los planes van en orden, sin horas repetidas y dentro de su bloque', () => {
  for (let id = 1; id <= 30; id++) for (const block of ['manana', 'tarde']) {
    const plan = autopilotPlan(who(id), DAY, block);
    const { from, to } = DEFAULT.BLOCKS[block];
    assert.equal(plan[0].min, from, 'el bloque empieza con algo');
    for (let i = 0; i < plan.length; i++) {
      assert.ok(plan[i].min >= from && plan[i].min < to, `${plan[i].hora} fuera de ${block}`);
      if (i) assert.ok(plan[i].min > plan[i - 1].min, 'desordenado o repetido');
      assert.ok(places.PLACES.includes(plan[i].lugar), `lugar desconocido: ${plan[i].lugar}`);
    }
  }
});

test('nadie se pasa más de hora y media sin moverse de la mesa por la mañana', () => {
  for (let id = 1; id <= 30; id++) {
    const plan = autopilotPlan(who(id), DAY, 'manana');
    const outs = plan.filter(a => a.lugar !== 'mesa').map(a => a.min);
    assert.ok(outs.length >= 1 && outs[0] - 540 <= 150, `persona ${id}: primera salida a las ${outs[0]}`);
  }
});

test('el de Sistemas pasa por servidores (al menos algún día)', () => {
  let n = 0;
  for (let d = 1; d <= 10; d++) {
    const day = `2026-11-${String(d).padStart(2, '0')}`;
    for (const block of ['manana', 'tarde']) {
      n += autopilotPlan(who(7, { position_title: 'Sistemas' }), day, block).filter(a => a.lugar === 'servidores').length;
    }
  }
  assert.ok(n >= 3, `solo ${n} visitas a servidores en 10 días`);
});

test('teletrabajo: todo en casa', () => {
  assert.ok(autopilotPlan(who(3), DAY, 'manana', { remote: true }).every(a => a.lugar === 'casa'));
});

test('escapadas: deterministas, a ratos y nunca nada más llegar', () => {
  const c = who(5);
  let busy = 0;
  for (let m = 540; m < 840; m++) {
    const a = micro.microFor(c, DAY, m, { blockFrom: 540, neighbor: 6 });
    assert.deepEqual(a, micro.microFor(c, DAY, m, { blockFrom: 540, neighbor: 6 }));
    if (m < 550) assert.equal(a, null);
    if (a) busy++;
  }
  assert.ok(busy > 20 && busy < 150, `minutos de escapada en la mañana: ${busy}`);
});

test('sin vecino no hay visita a la mesa de al lado', () => {
  for (let m = 550; m < 840; m++) {
    const a = micro.microFor(who(9), DAY, m, { blockFrom: 540, neighbor: null });
    assert.ok(!a || a.kind !== 'visita');
  }
});

test('el ping-pong es de dos y cada uno sabe con quién juega', () => {
  const ids = [1, 2, 3, 4, 5, 6];
  let partidas = 0;
  for (let m = 540; m < 1080; m += micro.SLOT) {
    const g = micro.groupPlans(1, DAY, m, ids);
    for (const [id, p] of g) {
      assert.ok(ids.includes(p.con) || p.con === null);
      if (p.kind === 'pingpong') {
        partidas++;
        assert.equal(g.get(p.con).con, id);
        assert.notEqual(g.get(p.con).i, p.i, 'los dos en el mismo lado de la mesa');
      }
    }
  }
  assert.ok(partidas > 0);
  assert.equal(micro.groupPlans(1, DAY, 600, [1]).get(1)?.kind === 'pingpong', false, 'ping-pong de uno solo');
});

test('los puntos de las escapadas no caen en una pared', () => {
  const map = require('../../frontend/src/assets/maps/office.json');
  for (const [name, list] of Object.entries(places.SPOT_TILES)) {
    list.forEach((_, i) => {
      const p = places.spotPos(name, i);
      const tile = map.grid[Math.floor((p.y - 1) / places.TILE)][Math.floor(p.x / places.TILE)];
      assert.notEqual(tile, '#', `${name} ${i} cae en una pared`);
    });
  }
});
