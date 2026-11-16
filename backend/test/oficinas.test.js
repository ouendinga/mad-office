// Las plantillas de oficina (backend/src/layouts): que sean planos válidos y que todo lo que la
// simulación necesita caiga en el suelo y se pueda alcanzar desde la entrada.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const layouts = require('../src/world/layout');
const places = require('../src/world/places');

const FLOOR = new Set(['.', 'D', '=']);
const reach = L => {
  // Desde cualquier puerta al exterior del plano (la entrada), por suelo.
  const seen = new Set();
  const q = [];
  L.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === 'D' && (y === 0 || y === L.rows - 1 || x === 0 || x === L.cols - 1 || (L.grid[y][x + 1] === ',' || L.grid[y][x - 1] === ','))) { q.push([x, y]); seen.add(`${x},${y}`); }
  }));
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= L.cols || ny >= L.rows || seen.has(`${nx},${ny}`)) continue;
      if (!FLOOR.has(L.grid[ny][nx])) continue;
      seen.add(`${nx},${ny}`); q.push([nx, ny]);
    }
  }
  return seen;
};

test('hay al menos las cuatro plantillas y la Clásica es la de siempre', () => {
  for (const id of ['clasica', 'loft', 'cubiculos', 'planta']) assert.ok(layouts.ids().includes(id), id);
  assert.equal(layouts.get('nada').id, 'clasica');
  const front = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'assets', 'maps', 'office.json'), 'utf8'));
  const back = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'layouts', 'clasica.json'), 'utf8'));
  assert.deepEqual(front, back, 'la copia del frontend no es la Clásica del servidor');
});

for (const id of layouts.ids()) {
  test(`${id}: plano válido y todo alcanzable desde la entrada`, () => {
    const L = layouts.get(id);
    assert.equal(L.grid.length, L.rows);
    for (const row of L.grid) assert.equal(row.length, L.cols);
    const ok = reach(L);
    const at = (x, y, what) => assert.ok(ok.has(`${Math.floor(x)},${Math.floor(y)}`), `${id}: ${what} (${x},${y}) no se alcanza o no es suelo`);
    L.desks.forEach((d, i) => at(d.x + 1, d.y - 1, `silla de la mesa ${i}`));
    for (const [z, r] of Object.entries(L.zones)) {
      for (let k = 0; k < places.zoneCapacity(z, L); k++) {
        const p = places.zoneSpotFixed(z, k, L);
        at(p.x / places.TILE, (p.y - 1) / places.TILE, `hueco ${k} de ${z}`);
      }
      assert.ok(r.w > 0 && r.h > 0);
    }
    for (const [name, list] of Object.entries(L.spots)) list.forEach(([x, y]) => at(x + 0.5, y, `escapada ${name}`));
    assert.ok(L.desks.length >= 6, 'muy pocas mesas');
  });
}

test('capacidad: Loft ~8, Cubículos ~12, Clásica 16, Planta grande ~30', () => {
  assert.equal(layouts.get('loft').desks.length, 8);
  assert.equal(layouts.get('cubiculos').desks.length, 12);
  assert.equal(layouts.get('clasica').desks.length, 16);
  assert.equal(layouts.get('planta').desks.length, 30);
});

test('sin el sitio en esta oficina, a su mesa (el Loft no tiene despacho)', () => {
  const L = layouts.get('loft');
  const p = places.targetFor({ lugar: 'despacho', deskIndex: 2, slot: 1 }, L);
  assert.deepEqual(p, places.deskPos(2, L));
});
