import officeMap from '../assets/maps/office.json';
import { objectDef } from '../engine/OfficeArt';
import { buildWalkable, findPath } from './paths';

const free = buildWalkable(officeMap, objectDef);
const TILE = 16;
// Destinos del servidor (backend/src/world/places.js), en casillas del mapa.
const zoneTiles = Object.entries(officeMap.zones).flatMap(([name, z]) => {
  const out = [];
  for (let y = z.y; y < z.y + z.h; y += 2) for (let x = z.x; x < z.x + z.w; x += 2) out.push([name, x, y]);
  return out;
});
const deskTiles = officeMap.desks.map(d => [d.x + 1, d.y - 1]); // sentado detrás de su mesa

test('las paredes y los muebles cortan el paso; alfombras y suelo no', () => {
  expect(free[0][0]).toBe(false); // pared
  const desk = officeMap.objects.find(o => o.type === 'desk');
  expect(free[desk.y][desk.x]).toBe(false);
  const rug = officeMap.objects.find(o => o.type === 'rug');
  expect(free[rug.y + 1][rug.x + 1] || officeMap.objects.some(o => o !== rug && o.x <= rug.x + 1 && rug.x + 1 < o.x + (o.w || 1) && o.y <= rug.y + 1 && rug.y + 1 < o.y + (o.h || 1))).toBe(true);
});

test('desde cualquier mesa se llega a cualquier sitio sin atravesar paredes ni muebles', () => {
  for (const [dx, dy] of deskTiles) {
    for (const [name, x, y] of zoneTiles) {
      const path = findPath(free, dx, dy, x, y);
      expect(path && name).toBe(name);
      // ningún paso intermedio cae en algo que no se pueda pisar
      for (const [px, py] of path.slice(1, -1)) expect(free[py][px]).toBe(true);
    }
  }
});

test('rodea a la gente quieta si puede', () => {
  const direct = findPath(free, 2, 10, 10, 10);
  const busy = new Set(direct.slice(1, -1).map(p => p.join(',')));
  const around = findPath(free, 2, 10, 10, 10, busy);
  expect(around.slice(1, -1).some(p => busy.has(p.join(',')))).toBe(false);
});
