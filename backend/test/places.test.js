const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const places = require('../src/world/places');

// El mapa vive en el frontend; places.js copia sus mesas y zonas. Si alguien cambia uno y no
// el otro, la gente acabaría de pie dentro de una pared.
const MAP = path.join(__dirname, '..', '..', 'frontend', 'src', 'assets', 'maps', 'office.json');
const map = JSON.parse(fs.readFileSync(MAP, 'utf8'));
const tileAt = (x, y) => map.grid[y][x];

test('las mesas y zonas de places.js son las del mapa', () => {
  assert.deepEqual(places.DESKS, map.desks);
  assert.deepEqual(places.ZONES, map.zones);
});

test('todo lugar tiene zona (salvo la mesa) y postura', () => {
  for (const p of places.PLACES) {
    if (p !== 'mesa') assert.ok(places.ZONES[p], `falta zona: ${p}`);
    assert.ok(places.ACTION_FOR_PLACE[p], `falta postura: ${p}`);
  }
});

test('nadie se queda de pie dentro de una pared', () => {
  const check = (pos, what) => {
    const tx = Math.floor(pos.x / places.TILE);
    const ty = Math.floor((pos.y - 1) / places.TILE);
    assert.notEqual(tileAt(tx, ty), '#', `${what} cae en una pared (${tx},${ty})`);
  };
  places.DESKS.forEach((_, i) => {
    check(places.deskPos(i), `mesa ${i}`);
    check(places.targetFor({ lugar: 'mesa', withDeskIndex: i, slot: 0 }), `visita a la mesa ${i}`);
  });
  for (const z of Object.keys(places.ZONES)) for (let s = 0; s < 30; s++) check(places.zonePos(z, s), `${z} #${s}`);
});

test('varios personajes en la misma zona no se pisan', () => {
  const seen = new Set();
  const pos = [];
  for (let s = 1; s <= 6; s++) {
    const p = places.zonePos('cafe', s);
    seen.add(`${p.x},${p.y}`);
    pos.push(p);
  }
  assert.equal(seen.size, 6);
  // y en la misma fila, al menos un sprite de ancho (dos casillas) entre uno y otro
  for (const a of pos) for (const b of pos) {
    if (a !== b && a.y === b.y) assert.ok(Math.abs(a.x - b.x) >= 2 * places.TILE);
  }
});
