// Lugares de la oficina, en casillas del plano. Cada empresa tiene su oficina (backend/src/layouts/,
// ver layout.js); todas las funciones de aquí reciben esa oficina como último parámetro `L` y, si no,
// usan la Clásica (la de siempre).
//
// Las posiciones que salen de aquí son los PIES del personaje, en píxeles de mundo
// (32 por casilla; el frontend dibuja a 16 por casilla y divide entre 2).

const layouts = require('./layout');

const TILE = 32;
const CLASICA = layouts.get('clasica');

// Lo de la Clásica, con los nombres de siempre (lo usan los tests y el código que no sabe de empresas).
const DESKS = CLASICA.desks;
const ZONES = CLASICA.zones;
const SPOT_TILES = CLASICA.spots;
const OWN_SPOTS = CLASICA.own;
const ZONE_SPOTS = CLASICA.zoneSpots;

// Sitios que entiende la IA. Es un vocabulario FIJO (va en el prompt y en el esquema JSON): una
// oficina sin alguno de ellos simplemente no lo tiene, y quien lo pida se queda en su mesa.
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

// Objetos del plano de los que dependen los incidentes («si no hay cafetera, no se rompe la
// cafetera»). Un test comprueba que están en la Clásica; en otras oficinas se mira su plano.
const INCIDENT_OBJECTS = ['vending', 'kitchen_counter', 'kanban', 'printer', 'stall', 'ac_unit', 'fridge', 'rack', 'plant', 'counter', 'water_cooler'];

const feet = (tx, ty) => ({ x: Math.round((tx + 0.5) * TILE), y: ty * TILE + TILE - 4 });

// Sentado detrás de su mesa, mirando a la cámara: el monitor y el tablero le tapan las piernas.
function deskPos(index, L = CLASICA) {
  const desks = L.desks;
  const d = desks[((index % desks.length) + desks.length) % desks.length];
  return { x: (d.x + 1) * TILE, y: d.y * TILE - 12 };
}

// Posición estable dentro de una zona para que no se pisen: un hueco cada dos casillas en
// horizontal (el sprite ocupa dos de ancho) y otro cada dos filas.
function zonePos(zoneName, slot, L = CLASICA) {
  const z = L.zones[zoneName];
  if (!z) return null;
  const cols = Math.max(1, Math.ceil(z.w / 2));
  const rows = Math.max(1, Math.ceil(z.h / 2));
  const cells = cols * rows;
  const i = ((slot * 5) % cells + cells) % cells; // salto primo: se reparten
  return { x: (z.x + (i % cols) * 2) * TILE + TILE / 2, y: (z.y + Math.floor(i / cols) * 2) * TILE + TILE - 4 };
}

// Hueco número k de una zona, en orden (sin saltos): primero una rejilla cada dos casillas; si se
// llena, otra encima desplazada media casilla y luego otra (se tapan un poco, pero no se montan).
function zoneSpot(zoneName, k, L = CLASICA) {
  const z = L.zones[zoneName];
  const cols = Math.max(1, Math.ceil(z.w / 2));
  const rows = Math.max(1, Math.ceil(z.h / 2));
  const cells = cols * rows;
  const layer = Math.floor(k / cells) % 3;
  const i = k % cells;
  const off = layer * (TILE / 2);
  return { x: (z.x + (i % cols) * 2) * TILE + TILE / 2 + off, y: (z.y + Math.floor(i / cols) * 2) * TILE + TILE - 4 + off / 2 };
}

// Puntos sueltos para las escapadas cortas (micro.js): impresora, fuente, kanban, máquina…
function spotPos(name, i = 0, L = CLASICA) {
  const list = L.spots[name];
  if (!list || !list.length) return null;
  const [tx, ty] = list[i % list.length];
  return feet(tx, ty);
}

// Sitio fijo de quien tiene despacho o mostrador: sentado detrás de su mesa.
function ownSpot(place, i = 0, L = CLASICA) {
  const list = L.own[place];
  if (!list) return zonePos(place, i, L);
  const [tx, ty] = list[i % list.length];
  return { x: Math.round((tx + 0.5) * TILE), y: ty * TILE - 12 };
}

// Huecos de una sala: los fijos si los tiene (las sillas de visitas, los urinarios…) y si no, de su
// zona, uno cada dos casillas. El aforo es el número de huecos.
function zoneCapacity(name, L = CLASICA) {
  if (L.zoneSpots[name]) return L.zoneSpots[name].length;
  const z = L.zones[name];
  return z ? Math.max(1, Math.ceil(z.w / 2)) * Math.max(1, Math.ceil(z.h / 2)) : 0;
}
function zoneSpotFixed(name, k, L = CLASICA) {
  const list = L.zoneSpots[name];
  if (!list) return zoneSpot(name, k, L);
  const [tx, ty] = list[k % list.length];
  return feet(tx, ty);
}

function targetFor({ lugar, deskIndex, withDeskIndex, slot }, L = CLASICA) {
  if (lugar === 'mesa' && withDeskIndex != null) {
    // De visita: de pie A UN LADO de la mesa del otro, a su altura (antes, delante de la mesa, y se
    // quedaba encima del que se sienta en la fila de abajo). Lado derecho o izquierdo según quién
    // visita, para que dos visitas a la misma mesa no se monten.
    const p = deskPos(withDeskIndex, L);
    const side = ((slot | 0) % 2 === 0 ? 1 : -1) * (TILE * 1.5);
    return { x: p.x + side, y: p.y };
  }
  // Si esta oficina no tiene ese sitio, a su mesa.
  if (lugar === 'mesa' || !L.zones[lugar]) return deskPos(deskIndex, L);
  return zonePos(lugar, slot, L);
}

module.exports = {
  INCIDENT_OBJECTS, TILE, DESKS, ZONES, ZONE_SPOTS, OWN_SPOTS, PLACES, ACTION_FOR_PLACE, SPOT_TILES,
  deskPos, zonePos, zoneSpot, zoneSpotFixed, zoneCapacity, spotPos, ownSpot, targetFor,
};
