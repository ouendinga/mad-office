// Lugares de la oficina, en coordenadas del mapa (frontend/src/assets/maps/office.json).
// Si cambia el mapa, hay que actualizar esto.

const TILE = 32;

const DESKS = [
  { x: 2, y: 3 }, { x: 5, y: 3 }, { x: 8, y: 3 }, { x: 11, y: 3 },
  { x: 2, y: 6 }, { x: 5, y: 6 }, { x: 8, y: 6 }, { x: 11, y: 6 },
];

const ZONES = {
  reuniones: { x: 13, y: 11, w: 5, h: 6 },
  cafe: { x: 18, y: 11, w: 5, h: 6 },
  lavabo: { x: 19, y: 1, w: 4, h: 3 },
};

const PLACES = ['mesa', 'cafe', 'reuniones', 'lavabo'];

// Postura del sprite según el sitio.
const ACTION_FOR_PLACE = {
  mesa: 'sentado',
  cafe: 'holgazaneando',
  reuniones: 'reunido',
  lavabo: 'lavabo',
  visita: 'paseando',
};

function deskPos(index) {
  const d = DESKS[index % DESKS.length];
  // Con más de 8 personajes, filas extra hacia abajo.
  const extraRow = Math.floor(index / DESKS.length) * 3;
  return { x: d.x * TILE, y: (d.y + extraRow) * TILE - 40 };
}

// Posición estable dentro de una zona para que no se pisen.
function zonePos(zoneName, slot) {
  const z = ZONES[zoneName];
  const cols = Math.max(1, z.w - 2);
  const col = slot % cols;
  const row = Math.floor(slot / cols) % Math.max(1, z.h - 2);
  return { x: (z.x + 0.5 + col) * TILE, y: (z.y + 0.6 + row) * TILE };
}

function targetFor({ lugar, deskIndex, withDeskIndex, slot }) {
  if (lugar === 'mesa' && withDeskIndex != null) {
    const p = deskPos(withDeskIndex);
    return { x: p.x + 40, y: p.y + 10 };
  }
  if (lugar === 'mesa') return deskPos(deskIndex);
  return zonePos(lugar, slot);
}

module.exports = { TILE, DESKS, ZONES, PLACES, ACTION_FOR_PLACE, deskPos, zonePos, targetFor };
