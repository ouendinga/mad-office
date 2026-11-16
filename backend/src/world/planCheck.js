// Planos dibujados con el diseñador: lo que se deduce del dibujo (mesas, huecos, aforos, sitios de
// las escapadas) y la validación, por REGLAS y con mensajes que entiende cualquiera. El servidor
// decide si un plano vale; el navegador solo enseña los avisos.

const ROOM_TYPES = {
  openspace: { label: 'Open space', zone: null },
  cocina: { label: 'Cocina', zone: 'cafe' },
  descanso: { label: 'Zona chill', zone: 'descanso' },
  banos: { label: 'Baños', zone: 'lavabo' },
  reuniones: { label: 'Sala de reuniones', zone: 'reuniones' },
  despacho: { label: 'Despacho del jefe', zone: 'despacho' },
  recepcion: { label: 'Recepción', zone: 'recepcion' },
  servidores: { label: 'Servidores', zone: 'servidores' },
  terraza: { label: 'Terraza', zone: 'terraza' },
  pasillo: { label: '', zone: null },
};
const FLOORS = ['wood', 'parquet', 'carpet', 'tiles', 'marble', 'bath', 'server', 'deck'];

// Muebles que se pueden poner, con su tamaño por defecto (casillas). `wall`: va colgado en una pared.
const CATALOG = {
  desk: { w: 2, h: 1, label: 'Mesa de trabajo' }, office_chair: { w: 2, h: 1, label: 'Silla de oficina' },
  boss_desk: { w: 3, h: 1, label: 'Mesa del jefe' }, small_desk: { w: 2, h: 1, label: 'Mesita' },
  cubicle: { w: 4, h: 4, label: 'Mampara de cubículo' }, counter: { w: 4, h: 1, label: 'Mostrador' },
  meeting_table: { w: 6, h: 2, label: 'Mesa de reuniones' }, chairs_row: { w: 6, h: 1, label: 'Fila de sillas' },
  guest_chair: { w: 1, h: 1, label: 'Silla de visitas' }, armchair: { w: 1, h: 1, label: 'Butaca' },
  sofa: { w: 3, h: 1, label: 'Sofá' }, beanbag: { w: 1, h: 1, label: 'Puf' }, coffee_table: { w: 2, h: 1, label: 'Mesita baja' },
  console: { w: 2, h: 1, label: 'Consola' }, pingpong: { w: 2, h: 2, label: 'Ping-pong' },
  kitchen_counter: { w: 5, h: 1, label: 'Encimera con cafetera' }, kitchen_table: { w: 3, h: 1, label: 'Mesa de cocina' },
  stools: { w: 3, h: 1, label: 'Taburetes' }, fridge: { w: 1, h: 1, label: 'Nevera' }, vending: { w: 1, h: 1, label: 'Máquina de snacks' },
  water_cooler: { w: 1, h: 1, label: 'Fuente de agua' }, printer: { w: 1, h: 1, label: 'Impresora' }, kanban: { w: 2, h: 1, label: 'Panel kanban' },
  bookshelf: { w: 2, h: 1, label: 'Estantería' }, trophy: { w: 1, h: 1, label: 'Trofeo' }, lamp: { w: 1, h: 1, label: 'Lámpara' },
  rack: { w: 1, h: 1, label: 'Rack de servidores' }, cable_floor: { w: 4, h: 1, label: 'Canaleta de cables' }, ac_unit: { w: 1, h: 1, label: 'Aire acondicionado' },
  stall: { w: 1, h: 1, label: 'Váter' }, urinal: { w: 1, h: 1, label: 'Urinario' }, sink_side: { w: 1, h: 1, label: 'Lavabo' },
  plant: { w: 1, h: 1, label: 'Planta' }, plant_big: { w: 1, h: 1, label: 'Planta grande' }, planter: { w: 1, h: 1, label: 'Jardinera' },
  tree: { w: 1, h: 1, label: 'Árbol' }, rug: { w: 3, h: 2, label: 'Alfombra' },
  terrace_table: { w: 2, h: 1, label: 'Mesa con sombrilla' }, bench: { w: 3, h: 1, label: 'Banco' }, string_lights: { w: 6, h: 1, label: 'Guirnalda de luces' },
  tv: { w: 2, h: 1, label: 'Tele (en la pared)', wall: true }, wall_window: { w: 2, h: 1, label: 'Ventana', wall: true },
  wall_screen: { w: 3, h: 1, label: 'Pantalla', wall: true }, wall_art: { w: 1, h: 1, label: 'Cuadro', wall: true },
  wall_kanban: { w: 2, h: 1, label: 'Pizarra', wall: true }, wall_clock: { w: 1, h: 1, label: 'Reloj', wall: true },
  wall_menu: { w: 1, h: 1, label: 'Menú', wall: true }, wall_logo: { w: 3, h: 1, label: 'Logo', wall: true },
};
// Lo que no corta el paso (se pisa o se sienta uno encima).
const WALKABLE = new Set(['rug', 'cable_floor', 'string_lights', 'office_chair', 'guest_chair', 'chairs_row', 'stools', 'sofa', 'beanbag', 'armchair', 'bench', 'cubicle', 'tv']);
const FLOOR_CH = new Set(['.', 'D', '=']);

const LIMITS = { minCols: 16, maxCols: 64, minRows: 12, maxRows: 40, maxObjects: 600, maxRooms: 30 };

// --- deducir lo que necesita la simulación ---

function blockedTiles(raw) {
  const set = new Set();
  for (const o of raw.objects || []) {
    const c = CATALOG[o.type];
    if (!c || c.wall || WALKABLE.has(o.type)) continue;
    for (let y = o.y; y < o.y + (o.h || 1); y++) for (let x = o.x; x < o.x + (o.w || 1); x++) set.add(`${x},${y}`);
  }
  return set;
}

function derive(raw) {
  if (raw.zones && raw.desks) return raw; // plantilla hecha a mano: ya trae todo
  const objs = raw.objects || [];
  const of = t => objs.filter(o => o.type === t);
  const blocked = blockedTiles(raw);
  const floorAt = (x, y) => raw.grid[y] && FLOOR_CH.has(raw.grid[y][x]) && !blocked.has(`${x},${y}`);
  const desks = of('desk').map(o => ({ x: o.x, y: o.y }));
  const zones = {};
  const zoneSpots = {};
  for (const r of raw.rooms || []) {
    const z = (ROOM_TYPES[r.type] || {}).zone;
    if (!z || zones[z]) continue;
    zones[z] = { x: r.x, y: r.y, w: r.w, h: r.h };
    const spots = [];
    for (let y = r.y + 1; y < r.y + r.h; y += 2) for (let x = r.x; x < r.x + r.w; x += 2) if (floorAt(x, y)) spots.push([x, y]);
    if (!spots.length) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (floorAt(x, y)) spots.push([x, y]);
    zoneSpots[z] = spots.slice(0, 24);
  }
  const center = o => o.x + ((o.w || 1) - 1) / 2;
  const own = {};
  const boss = of('boss_desk')[0];
  if (boss) own.despacho = [[center(boss), boss.y]];
  const counter = of('counter')[0];
  if (counter) own.recepcion = [[center(counter), counter.y]];
  const below = t => of(t).slice(0, 1).map(o => [o.x + ((o.w || 1) > 1 ? 1 : 0), o.y + (o.h || 1)]);
  const spots = {};
  for (const [name, type] of [['impresora', 'printer'], ['fuente', 'water_cooler'], ['kanban', 'kanban'], ['maquina', 'vending']]) {
    const s = below(type);
    if (s.length) spots[name] = s;
  }
  const pp = of('pingpong')[0];
  if (pp) spots.pingpong = [[pp.x + 0.5, pp.y - 1], [pp.x + 0.5, pp.y + (pp.h || 2)]];
  const sofa = of('sofa')[0];
  if (sofa && of('console').length) spots.consola = [[sofa.x + 0.5, sofa.y], [sofa.x + 1.5, sofa.y]];
  const terr = (raw.rooms || []).find(r => r.type === 'terraza');
  return {
    ...raw, tile: 16, desks, zones, zoneSpots, own, spots,
    outdoorFromCol: terr ? terr.x : raw.cols,
    rooms: (raw.rooms || []).map(r => ({ ...r, id: r.id || r.type, label: r.label ?? (ROOM_TYPES[r.type] || {}).label ?? '' })),
  };
}

// --- validar ---

function validate(raw) {
  const errors = [];
  const warnings = [];
  const E = m => errors.push(m);
  if (!raw || typeof raw !== 'object') return { errors: ['No es un plano.'], warnings };
  const { cols, rows, grid } = raw;
  if (!Number.isInteger(cols) || cols < LIMITS.minCols || cols > LIMITS.maxCols) E(`El ancho va de ${LIMITS.minCols} a ${LIMITS.maxCols} casillas.`);
  if (!Number.isInteger(rows) || rows < LIMITS.minRows || rows > LIMITS.maxRows) E(`El alto va de ${LIMITS.minRows} a ${LIMITS.maxRows} casillas.`);
  if (!Array.isArray(grid) || grid.length !== rows || grid.some(r => typeof r !== 'string' || r.length !== cols || /[^#.D=,]/.test(r))) {
    E('La rejilla del plano está mal formada.');
    return { errors, warnings };
  }
  const rooms = Array.isArray(raw.rooms) ? raw.rooms : [];
  const objects = Array.isArray(raw.objects) ? raw.objects : [];
  if (rooms.length > LIMITS.maxRooms) E(`Como mucho ${LIMITS.maxRooms} salas.`);
  if (objects.length > LIMITS.maxObjects) E(`Como mucho ${LIMITS.maxObjects} muebles.`);
  for (const r of rooms) {
    if (!ROOM_TYPES[r.type]) E(`Hay una sala de un tipo que no existe («${r.type}»).`);
    if (!FLOORS.includes(r.floor)) E(`La sala «${r.label || r.type}» tiene un suelo que no existe.`);
    if (!(r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0 && r.x + r.w <= cols && r.y + r.h <= rows)) E(`La sala «${r.label || r.type}» se sale del plano.`);
    if (r.label != null && (typeof r.label !== 'string' || r.label.length > 40)) E('El nombre de una sala es demasiado largo.');
    if (r.wall != null && !/^#[0-9a-fA-F]{6}$/.test(r.wall)) E(`El color de pared de «${r.label || r.type}» no vale.`);
  }
  for (const o of objects) {
    const c = CATALOG[o.type];
    if (!c) { E(`Hay un mueble que no existe («${o.type}»).`); continue; }
    const w = o.w || 1;
    const h = o.h || 1;
    if (!(Number.isInteger(o.x) && Number.isInteger(o.y) && o.x >= 0 && o.y >= 0 && o.x + w <= cols && o.y + h <= rows && w <= 12 && h <= 12)) {
      E(`${c.label}: se sale del plano.`); continue;
    }
    if (!c.wall && o.type !== 'tree') {
      for (let y = o.y; y < o.y + h; y++) for (let x = o.x; x < o.x + w; x++) {
        if (grid[y][x] === '#') { E(`${c.label} (casilla ${x},${y}) está metido en una pared.`); y = o.y + h; break; }
      }
    }
  }
  if (errors.length) return { errors, warnings };

  const L = derive(raw);
  if (!rooms.some(r => r.type === 'openspace')) E('Falta un open space (la sala donde trabajan).');
  if (L.desks.length < 2) E('Pon al menos 2 mesas de trabajo.');
  // Entradas: puertas en el borde del plano o que dan a la calle (césped).
  const isOut = (x, y) => x < 0 || y < 0 || x >= cols || y >= rows || grid[y][x] === ',';
  const starts = [];
  grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === 'D' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isOut(x + dx, y + dy))) starts.push([x, y]);
  }));
  if (!starts.length) E('No hay puerta de entrada: pon una puerta en una pared que dé a fuera.');
  // Por dónde se puede andar (suelo sin muebles que corten el paso) desde la entrada.
  const blocked = blockedTiles(raw);
  const seen = new Set(starts.map(([x, y]) => `${x},${y}`));
  const q = starts.slice();
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy;
      const k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen.has(k)) continue;
      if (!FLOOR_CH.has(grid[ny][nx]) || blocked.has(k)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  if (starts.length) {
    const lost = L.desks.filter(d => !seen.has(`${d.x + 1},${d.y - 1}`) && !seen.has(`${d.x},${d.y - 1}`));
    if (lost.length) E(`${lost.length === 1 ? 'Una mesa no tiene' : `${lost.length} mesas no tienen`} sitio libre detrás para sentarse o no se llega a ${lost.length === 1 ? 'ella' : 'ellas'} (deja la casilla de arriba libre y con camino).`);
    for (const r of rooms) {
      if (!ROOM_TYPES[r.type].zone && r.type !== 'openspace') continue;
      let reach = false;
      for (let y = r.y; y < r.y + r.h && !reach; y++) for (let x = r.x; x < r.x + r.w; x++) if (seen.has(`${x},${y}`)) { reach = true; break; }
      if (!reach) E(`No se puede entrar en «${r.label || ROOM_TYPES[r.type].label}»: ponle una puerta.`);
    }
  }
  const has = t => rooms.some(r => r.type === t);
  if (!has('cocina')) warnings.push('Sin cocina: no habrá café ni comidas en grupo (comerán en la mesa).');
  if (!has('banos')) warnings.push('Sin baños. ¿Seguro?');
  if (!has('despacho')) warnings.push('Sin despacho: el jefe se sentará con todos.');
  if (has('cocina') && !objects.some(o => o.type === 'kitchen_counter')) warnings.push('La cocina no tiene encimera con cafetera.');
  if (has('banos') && !objects.some(o => o.type === 'stall')) warnings.push('Los baños no tienen váter.');
  return { errors, warnings, desks: L.desks.length };
}

module.exports = { ROOM_TYPES, FLOORS, CATALOG, LIMITS, derive, validate };
