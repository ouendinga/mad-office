// Lugares de la oficina, en casillas del mapa (frontend/src/assets/maps/office.json).
// El test places.test.js comprueba que esto y el mapa digan lo mismo.
//
// Las posiciones que salen de aquí son los PIES del personaje, en píxeles de mundo
// (32 por casilla; el frontend dibuja a 16 por casilla y divide entre 2).

const TILE = 32;

// Mesas del open space (la casilla de arriba a la izquierda de cada mesa de 2x1).
const DESKS = [];
for (const y of [13, 16, 19, 22]) for (const x of [2, 6, 10, 14]) DESKS.push({ x, y });

// Zonas donde se queda de pie la gente en cada sitio.
const ZONES = {
  recepcion: { x: 2, y: 5, w: 5, h: 2 },
  despacho: { x: 10, y: 5, w: 4, h: 2 },
  reuniones: { x: 17, y: 2, w: 6, h: 4 },
  servidores: { x: 25, y: 4, w: 5, h: 2 },
  cafe: { x: 21, y: 14, w: 8, h: 3 },
  descanso: { x: 21, y: 21, w: 5, h: 3 },
  lavabo: { x: 29, y: 21, w: 1, h: 3 }, // el pasillo entre urinarios y lavabos
  terraza: { x: 33, y: 3, w: 4, h: 20 },
};

const PLACES = ['mesa', 'cafe', 'reuniones', 'descanso', 'terraza', 'recepcion', 'despacho', 'servidores', 'lavabo'];

// Postura del sprite según el sitio.
const ACTION_FOR_PLACE = {
  mesa: 'sentado',
  cafe: 'holgazaneando',
  reuniones: 'reunido',
  descanso: 'holgazaneando',
  terraza: 'holgazaneando',
  recepcion: 'reunido',
  despacho: 'reunido',
  servidores: 'pizarra',
  lavabo: 'lavabo',
  casa: 'sentado', // teletrabajo: no sale en el mapa de la oficina
  visita: 'paseando',
};

// Sentado detrás de su mesa, mirando a la cámara: el monitor y el tablero le tapan las piernas.
function deskPos(index) {
  const d = DESKS[((index % DESKS.length) + DESKS.length) % DESKS.length];
  return { x: (d.x + 1) * TILE, y: d.y * TILE - 12 };
}

// Posición estable dentro de una zona para que no se pisen: un hueco cada dos casillas en
// horizontal (el sprite ocupa dos de ancho) y otro cada dos filas.
function zonePos(zoneName, slot) {
  const z = ZONES[zoneName];
  // También una fila de cada dos: el personaje mide casilla y media y se montaban.
  const cols = Math.max(1, Math.ceil(z.w / 2));
  const rows = Math.max(1, Math.ceil(z.h / 2));
  const cells = cols * rows;
  const i = ((slot * 5) % cells + cells) % cells; // salto primo: se reparten
  const col = (i % cols) * 2;
  const row = Math.floor(i / cols) * 2;
  return { x: (z.x + col) * TILE + TILE / 2, y: (z.y + row) * TILE + TILE - 4 };
}

// Hueco número k de una zona, en orden (sin saltos): primero una rejilla cada dos casillas; si se
// llena, otra encima desplazada media casilla y luego otra (se tapan un poco, pero no se montan).
function zoneSpot(zoneName, k) {
  const z = ZONES[zoneName];
  const cols = Math.max(1, Math.ceil(z.w / 2));
  const rows = Math.max(1, Math.ceil(z.h / 2));
  const cells = cols * rows;
  const layer = Math.floor(k / cells) % 3;
  const i = k % cells;
  const off = layer * (TILE / 2);
  return { x: (z.x + (i % cols) * 2) * TILE + TILE / 2 + off, y: (z.y + Math.floor(i / cols) * 2) * TILE + TILE - 4 + off / 2 };
}

// Puntos sueltos para las escapadas cortas (micro.js), en casillas: los pies del personaje.
const SPOT_TILES = {
  impresora: [[17, 16]],
  fuente: [[15, 10]],
  kanban: [[18, 13]],
  maquina: [[27, 13]], // delante de la máquina de snacks
  pingpong: [[24.5, 20], [24.5, 23]], // arriba y abajo de la mesa (2×2 en 24-25, 21-22)
  consola: [[21.5, 20], [22.5, 20]], // en el sofá, delante de la tele
};
const spotPos = (name, i = 0) => {
  const list = SPOT_TILES[name];
  const [tx, ty] = list[i % list.length];
  return { x: Math.round((tx + 0.5) * TILE), y: ty * TILE + TILE - 4 };
};

function targetFor({ lugar, deskIndex, withDeskIndex, slot }) {
  if (lugar === 'mesa' && withDeskIndex != null) {
    // De visita: de pie al lado de la mesa del otro, delante.
    const p = deskPos(withDeskIndex);
    return { x: p.x + 22, y: p.y + TILE + 22 };
  }
  if (lugar === 'mesa' || !ZONES[lugar]) return deskPos(deskIndex);
  return zonePos(lugar, slot);
}

module.exports = { TILE, DESKS, ZONES, PLACES, ACTION_FOR_PLACE, SPOT_TILES, deskPos, zonePos, zoneSpot, spotPos, targetFor };
