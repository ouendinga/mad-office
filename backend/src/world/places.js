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
  lavabo: { x: 28, y: 21, w: 3, h: 3 },
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

function targetFor({ lugar, deskIndex, withDeskIndex, slot }) {
  if (lugar === 'mesa' && withDeskIndex != null) {
    // De visita: de pie al lado de la mesa del otro, delante.
    const p = deskPos(withDeskIndex);
    return { x: p.x + 22, y: p.y + TILE + 22 };
  }
  if (lugar === 'mesa' || !ZONES[lugar]) return deskPos(deskIndex);
  return zonePos(lugar, slot);
}

module.exports = { TILE, DESKS, ZONES, PLACES, ACTION_FOR_PLACE, deskPos, zonePos, targetFor };
