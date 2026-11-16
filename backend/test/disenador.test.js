// Diseñador: lo que se deduce de un plano dibujado y la validación (planCheck.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { validate, derive } = require('../src/world/planCheck');
const layouts = require('../src/world/layout');
const places = require('../src/world/places');

// Un plano «como lo dibujaría alguien»: el Loft sin lo que se deduce y con el tipo de cada sala.
const drawn = () => {
  const L = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'layouts', 'loft.json'), 'utf8'));
  return {
    cols: L.cols, rows: L.rows, grid: L.grid.slice(),
    rooms: L.rooms.map(({ id, label, x, y, w, h, floor, wall }) => ({ type: id, label, x, y, w, h, floor, wall })),
    objects: L.objects.map(o => ({ ...o })),
  };
};

test('un plano dibujado bien no tiene errores y se deducen mesas, huecos y sitios', () => {
  const v = validate(drawn());
  assert.deepEqual(v.errors, []);
  assert.equal(v.desks, 8);
  const L = layouts.fromData({ ...drawn(), id: 'p1', name: 'Mía' });
  assert.equal(L.desks.length, 8);
  assert.ok(L.zones.cafe && L.zones.lavabo && L.zones.descanso);
  assert.ok(places.zoneCapacity('cafe', L) > 0);
  assert.ok(L.spots.impresora && L.spots.maquina && L.spots.consola);
  assert.ok(L.places.has('cafe') && !L.places.has('despacho'));
});

test('sin puerta a la calle, error', () => {
  const p = drawn();
  p.grid = p.grid.map(r => r.replace(/D/g, '#'));
  assert.match(validate(p).errors.join(' '), /puerta de entrada/);
});

test('una sala sin puerta: no se puede entrar', () => {
  const p = drawn();
  // tapia la puerta entre el loft y la cocina (16,4)
  p.grid[4] = `${p.grid[4].slice(0, 16)}#${p.grid[4].slice(17)}`;
  assert.match(validate(p).errors.join(' '), /No se puede entrar en «Cocina»/);
});

test('un mueble metido en una pared y uno inventado, errores con su nombre', () => {
  const p = drawn();
  p.objects.push({ type: 'vending', x: 0, y: 5 }, { type: 'cohete', x: 3, y: 3 });
  const e = validate(p).errors.join(' ');
  assert.match(e, /Máquina de snacks .* pared/);
  assert.match(e, /no existe/);
});

test('sin open space o sin mesas, error; sin cocina, solo aviso', () => {
  const p = drawn();
  p.rooms = p.rooms.filter(r => r.type !== 'cocina');
  const v = validate(p);
  assert.deepEqual(v.errors, []);
  assert.match(v.warnings.join(' '), /Sin cocina/);
  const q = drawn();
  q.objects = q.objects.filter(o => o.type !== 'desk');
  assert.match(validate(q).errors.join(' '), /al menos 2 mesas/);
  const r = drawn();
  r.rooms = r.rooms.filter(x => x.type !== 'openspace');
  assert.match(validate(r).errors.join(' '), /Falta un open space/);
});

test('límites de tamaño y rejilla mal formada', () => {
  assert.match(validate({ ...drawn(), cols: 200 }).errors.join(' '), /ancho/);
  const p = drawn();
  p.grid[0] = `${p.grid[0]}X`;
  assert.match(validate(p).errors.join(' '), /rejilla/);
});

test('las plantillas hechas a mano no se tocan al deducir', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'layouts', 'clasica.json'), 'utf8'));
  assert.equal(derive(raw), raw);
});

for (const id of ['loft', 'cubiculos', 'planta']) {
  test(`la plantilla ${id} pasa el validador del diseñador (muebles incluidos)`, () => {
    const L = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'layouts', `${id}.json`), 'utf8'));
    const p = { cols: L.cols, rows: L.rows, grid: L.grid, objects: L.objects,
      rooms: L.rooms.map(({ id: type, label, x, y, w, h, floor, wall }) => ({ type, label, x, y, w, h, floor, wall })) };
    assert.deepEqual(validate(p).errors, []);
  });
}
