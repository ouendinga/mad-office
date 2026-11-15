// Por dónde se puede andar: paredes y muebles cortan el paso (alfombras, cables y lo que cuelga de
// la pared, no). Camino más corto con A* por casillas, sin cortar esquinas, rodeando a la gente que
// está quieta cuando se puede. La casilla de destino siempre vale (sentarse en el sofá, ponerse
// delante de la máquina…).

const FREE_TILES = new Set(['.', 'D', '=']);
// Los asientos tampoco: la gente se sienta en ellos (sillas de la sala, taburetes, sofá, puf, bancos).
const NOT_BLOCKING = new Set(['rug', 'cable_floor', 'string_lights', 'tv', 'chairs_row', 'stools', 'sofa', 'beanbag', 'armchair', 'bench']);

export function buildWalkable(map, objectDef) {
  const { cols, rows, grid } = map;
  const free = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => FREE_TILES.has(grid[y][x])));
  for (const o of map.objects) {
    const d = objectDef(o.type) || {};
    if (NOT_BLOCKING.has(o.type) || d.flat || d.wall || d.overlay || String(o.type).startsWith('wall_')) continue;
    for (let y = o.y; y < o.y + (o.h || 1); y++) {
      for (let x = o.x; x < o.x + (o.w || 1); x++) if (free[y] && free[y][x] !== undefined) free[y][x] = false;
    }
  }
  return free;
}

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [1, -1, 1.41], [-1, 1, 1.41], [-1, -1, 1.41]];

// Camino de (sx,sy) a (tx,ty) en casillas, o null. busy: Set de "x,y" ocupadas por gente quieta.
export function findPath(free, sx, sy, tx, ty, busy = new Set()) {
  const rows = free.length;
  const cols = free[0].length;
  const ok = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && (free[y][x] || (x === tx && y === ty) || (x === sx && y === sy));
  if (!ok(sx, sy) || !ok(tx, ty)) return null;
  const key = (x, y) => y * cols + x;
  const g = new Map([[key(sx, sy), 0]]);
  const from = new Map();
  const h = (x, y) => Math.hypot(tx - x, ty - y);
  const open = [[h(sx, sy), sx, sy]];
  const closed = new Set();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, x, y] = open.splice(bi, 1)[0];
    const k = key(x, y);
    if (closed.has(k)) continue;
    closed.add(k);
    if (x === tx && y === ty) {
      const path = [[x, y]];
      let c = k;
      while (from.has(c)) { c = from.get(c); path.push([c % cols, Math.floor(c / cols)]); }
      return path.reverse();
    }
    for (const [dx, dy, cost] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!ok(nx, ny)) continue;
      if (dx && dy && (!ok(x + dx, y) || !ok(x, y + dy))) continue; // sin cortar esquinas
      const nk = key(nx, ny);
      const ng = g.get(k) + cost + (busy.has(`${nx},${ny}`) && !(nx === tx && ny === ty) ? 4 : 0);
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        from.set(nk, k);
        open.push([ng + h(nx, ny), nx, ny]);
      }
    }
  }
  return null;
}
