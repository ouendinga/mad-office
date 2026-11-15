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

const statsLib = require('../src/world/stats');

test('el pentágono se mueve con el tiempo: hambre siempre, la mesa cansa, la gente da vida social', () => {
  const desk = statsLib.drift('mesa', 240);
  assert.ok(desk.saciedad <= -1.3, 'cuatro horas sin comer no dan hambre');
  assert.ok(desk.energia < 0 && desk.social < 0);
  const cafe = statsLib.drift('cafe', 30);
  assert.ok(cafe.social > 0);
  assert.ok(statsLib.drift('descanso', 60).energia > 0);
});

test('comer llena también en la terraza, y la máquina quita el hambre', () => {
  const s = { energia: 3, animo: 3, saciedad: 1, social: 3, calma: 3 };
  assert.ok(statsLib.applyAction(s, { lugar: 'terraza', min: 840 }).saciedad >= 2.5);
  assert.ok(statsLib.applyAction(s, { lugar: 'mesa', min: 845, comida: true }).saciedad >= 2.3);
  assert.ok(statsLib.applyMicro(s, 'maquina').saciedad > s.saciedad);
});

test('con hambre, las escapadas van casi siempre a la máquina', () => {
  let maquina = 0;
  let total = 0;
  for (let m = 560; m < 840; m++) {
    const a = micro.microFor(who(4), DAY, m, { blockFrom: 540, neighbor: 5, hungry: true });
    if (a && a.id !== (micro.microFor(who(4), DAY, m - 1, { blockFrom: 540, neighbor: 5, hungry: true }) || {}).id) {
      total++;
      if (a.kind === 'maquina') maquina++;
    }
  }
  assert.ok(total > 0 && maquina / total >= 0.6, `${maquina} de ${total}`);
});

const { lunchGroups } = require('../src/world/lunch');

test('comida: todos comen en la franja, en grupos de 2-4 o solos, y los grupos son coherentes', () => {
  const chars = Array.from({ length: 16 }, (_, i) => ({ id: i + 1, position_id: 1 + (i % 4), position_parent: 1 }));
  const g = lunchGroups(chars, DAY);
  assert.equal(g.size, 16);
  let solos = 0;
  for (const [id, x] of g) {
    assert.ok(x.offset >= 0 && x.offset <= 25);
    assert.ok(x.con.length <= 3);
    if (!x.con.length) solos++;
    for (const o of x.con) {
      assert.ok(g.get(o).con.includes(id), 'grupo no recíproco');
      assert.equal(g.get(o).lugar, x.lugar);
      assert.equal(g.get(o).offset, x.offset);
    }
  }
  assert.ok(solos < 16, 'nadie come acompañado');
  const plan = autopilotPlan(who(1), DAY, 'tarde', { lunch: g.get(1) });
  assert.ok(plan.some(a => a.comida && a.lugar === g.get(1).lugar));
});

test('comida: nadie se amontona por encima del aforo', () => {
  for (let d = 1; d <= 20; d++) {
    const chars = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, position_id: 1 + (i % 3), position_parent: 1 }));
    const count = {};
    for (const x of lunchGroups(chars, `2026-11-${String(d).padStart(2, '0')}`).values()) count[x.lugar] = (count[x.lugar] || 0) + 1;
    assert.ok((count.cafe || 0) <= 8 && (count.terraza || 0) <= 10 && (count.descanso || 0) <= 4, JSON.stringify(count));
  }
});
