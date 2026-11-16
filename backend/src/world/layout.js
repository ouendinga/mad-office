// Las oficinas (planos) disponibles: backend/src/layouts/<id>.json. Cada empresa usa una (por
// defecto la Clásica) y se cambia de una a otra con una mudanza. El plano trae la rejilla, las
// salas, los muebles, las mesas y los huecos donde se coloca la gente; de ahí sale todo lo demás
// (aforos, qué incidentes pueden pasar, qué escapadas hay).
//
// El frontend tiene una copia de la Clásica (frontend/src/assets/maps/office.json) para pintar
// algo antes de que llegue la de la empresa; un test comprueba que es igual.

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'layouts');
const DEFAULT_ID = 'clasica';
const cache = new Map();

function load(id) {
  const file = path.join(DIR, `${id}.json`);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const L = {
    ...raw,
    zoneSpots: raw.zoneSpots || {},
    own: raw.own || {},
    spots: raw.spots || {},
    objectTypes: new Set(raw.objects.map(o => o.type)),
  };
  // Qué sitios tiene (para no mandar a nadie a un despacho que no existe).
  L.places = new Set(['mesa', ...Object.keys(L.zones)]);
  return L;
}

function ids() {
  return fs.readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
}

function get(id) {
  const key = id && ids().includes(id) ? id : DEFAULT_ID;
  if (!cache.has(key)) cache.set(key, load(key));
  return cache.get(key);
}

// Para la galería: lo justo para enseñarla y compararla.
function summary(L) {
  return {
    id: L.id, name: L.name, description: L.description, cols: L.cols, rows: L.rows,
    desks: L.desks.length, rooms: L.rooms.filter(r => r.label).map(r => r.label),
  };
}

module.exports = { get, ids, summary, DEFAULT_ID };
