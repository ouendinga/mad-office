// Las oficinas (planos) disponibles: backend/src/layouts/<id>.json. Cada empresa usa una (por
// defecto la Clásica) y se cambia de una a otra con una mudanza. El plano trae la rejilla, las
// salas, los muebles, las mesas y los huecos donde se coloca la gente; de ahí sale todo lo demás
// (aforos, qué incidentes pueden pasar, qué escapadas hay).
//
// El frontend tiene una copia de la Clásica (frontend/src/assets/maps/office.json) para pintar
// algo antes de que llegue la de la empresa; un test comprueba que es igual.

const fs = require('fs');
const path = require('path');
const { derive } = require('./planCheck');

const DIR = path.join(__dirname, '..', 'layouts');
const DEFAULT_ID = 'clasica';
const cache = new Map();

function load(id) {
  return fromData(JSON.parse(fs.readFileSync(path.join(DIR, `${id}.json`), 'utf8')));
}

// Un plano (plantilla o dibujado con el diseñador) listo para usar: lo que no traiga se deduce.
function fromData(data) {
  const raw = derive(data);
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

// Las dibujadas por la empresa van en la base de datos con id 'p<n>'.
const isCustom = id => /^p\d+$/.test(String(id || ''));

async function getFor(pool, companyId, id) {
  if (!isCustom(id)) return get(id);
  const row = (await pool.query('SELECT id, name, data FROM office_plans WHERE id = $1 AND company_id = $2', [Number(id.slice(1)), companyId])).rows[0];
  if (!row) return get(DEFAULT_ID);
  return fromData({ ...row.data, id: `p${row.id}`, name: row.name, description: row.data.description || 'Dibujada con el diseñador.' });
}

async function customFor(pool, companyId) {
  const rows = (await pool.query('SELECT id, name, data FROM office_plans WHERE company_id = $1 ORDER BY id', [companyId])).rows;
  return rows.map(r => fromData({ ...r.data, id: `p${r.id}`, name: r.name, description: r.data.description || 'Dibujada con el diseñador.' }));
}

// Para la galería: lo justo para enseñarla y compararla.
function summary(L) {
  return {
    id: L.id, name: L.name, description: L.description, cols: L.cols, rows: L.rows,
    desks: L.desks.length, rooms: L.rooms.filter(r => r.label).map(r => r.label),
  };
}

module.exports = { get, getFor, customFor, fromData, isCustom, ids, summary, DEFAULT_ID };
