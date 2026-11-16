// El tiempo de verdad donde está la oficina (Open-Meteo, sin clave). Se pide desde el servidor
// cada 30 minutos como mucho y se cachea: nada de una petición por visitante.

const DEFAULT_LOCATION = { city: 'Madrid', country: 'España', lat: 40.4168, lon: -3.7038 };
const EVERY_MS = 30 * 60 * 1000;

// Códigos WMO → texto corto en español.
function describe(code) {
  if (code === 0) return 'despejado';
  if (code <= 2) return 'algo nuboso';
  if (code === 3) return 'nublado';
  if (code === 45 || code === 48) return 'niebla';
  if (code >= 51 && code <= 57) return 'llovizna';
  if (code >= 61 && code <= 65) return code === 65 ? 'lluvia fuerte' : 'lluvia';
  if (code === 66 || code === 67) return 'lluvia helada';
  if (code >= 71 && code <= 77) return 'nieve';
  if (code >= 80 && code <= 82) return 'chubascos';
  if (code === 85 || code === 86) return 'chubascos de nieve';
  if (code >= 95) return 'tormenta';
  return 'variable';
}

// Estación astronómica aproximada; en el hemisferio sur, al revés.
function season(date, lat = 40) {
  const [, m, d] = date.split('-').map(Number);
  const md = m * 100 + d;
  let s;
  if (md >= 321 && md < 621) s = 'primavera';
  else if (md >= 621 && md < 923) s = 'verano';
  else if (md >= 923 && md < 1221) s = 'otono';
  else s = 'invierno';
  if (lat < 0) s = { primavera: 'otono', verano: 'invierno', otono: 'primavera', invierno: 'verano' }[s];
  return s;
}

// Una línea para el prompt (barata): «Tiempo: lluvia, 9 °C (otoño)».
function promptLine(weather, seasonName) {
  if (!weather) return `Estación: ${seasonName}.`;
  return `Tiempo fuera: ${weather.desc}, ${Math.round(weather.temp)} °C (${seasonName}).`;
}

async function fetchCurrent(loc, fetchImpl = fetch) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}`
    + '&current=temperature_2m,weather_code,precipitation,wind_speed_10m,is_day&timezone=auto';
  const res = await fetchImpl(url, { headers: { 'user-agent': 'mad-office' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const c = (await res.json()).current;
  return {
    temp: c.temperature_2m,
    code: c.weather_code,
    desc: describe(c.weather_code),
    precip: c.precipitation,
    wind: c.wind_speed_10m,
    isDay: c.is_day === 1,
    at: Date.now(),
  };
}

async function geocode(name, fetchImpl = fetch) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&language=es&name=${encodeURIComponent(name)}`;
  const res = await fetchImpl(url, { headers: { 'user-agent': 'mad-office' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`geocoding ${res.status}`);
  const r = ((await res.json()).results || [])[0];
  if (!r) return null;
  // La comunidad (admin1) sirve para los festivos autonómicos (holidays.js).
  return { city: r.name, country: r.country || '', region: r.admin1 || '', lat: r.latitude, lon: r.longitude };
}

// Caché compartida por coordenadas: dos empresas en la misma ciudad no piden dos veces.
const cache = new Map(); // "lat,lon" -> { data, at, pending }

async function cachedCurrent(loc) {
  const key = `${Number(loc.lat).toFixed(2)},${Number(loc.lon).toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && hit.data && Date.now() - hit.at < EVERY_MS) return hit.data;
  if (hit && hit.pending) return hit.pending;
  const pending = fetchCurrent(loc)
    .then(data => { cache.set(key, { data, at: Date.now() }); return data; })
    .catch(e => { cache.delete(key); throw e; });
  cache.set(key, { ...(hit || {}), pending });
  return pending;
}

// El tiempo de UNA empresa (su ubicación vive en companies.settings.location).
class Weather {
  constructor(pool, companyId) {
    this.pool = pool;
    this.companyId = companyId;
    this.location = DEFAULT_LOCATION;
    this.current = null;
  }

  async loadLocation() {
    const r = await this.pool.query("SELECT settings->'location' AS loc FROM companies WHERE id = $1", [this.companyId]);
    const loc = r.rows[0] && r.rows[0].loc;
    if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lon)) this.location = loc;
    return this.location;
  }

  async setLocation(loc) {
    await this.pool.query(
      `UPDATE companies SET settings = jsonb_set(settings, '{location}', $2::jsonb) WHERE id = $1`,
      [this.companyId, JSON.stringify(loc)]);
    this.location = loc;
    this.current = null;
    await this.refresh();
  }

  async refresh() {
    try {
      this.current = await cachedCurrent(this.location);
    } catch (e) {
      console.error('tiempo:', e.message); // sin tiempo, la oficina sigue: el prompt dice solo la estación
    }
  }

  start() {
    this.loadLocation().then(() => this.refresh()).catch(e => console.error('tiempo:', e.message));
    this.timer = setInterval(() => this.refresh(), EVERY_MS);
  }

  stop() {
    clearInterval(this.timer);
  }
}

module.exports = { DEFAULT_LOCATION, describe, season, promptLine, fetchCurrent, geocode, Weather };
