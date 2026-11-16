// Festivos para los sucesos de fuera (el puente): nacionales, Semana Santa y los autonómicos más
// estables. 🔶 Los calendarios autonómicos cambian algo cada año (y hay traslados a lunes): esto es
// una aproximación para la comedia, no un calendario laboral oficial.

// Nacionales fijos (MM-DD).
const NATIONAL = ['01-01', '01-06', '05-01', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25'];

// Autonómicos fijos más estables, y si celebran Jueves Santo y Lunes de Pascua.
const REGIONS = {
  madrid: { fixed: ['05-02'], jueves: true },
  cataluna: { fixed: ['09-11', '12-26'], lunes: true },
  andalucia: { fixed: ['02-28'], jueves: true },
  valenciana: { fixed: ['10-09'], lunes: true },
  galicia: { fixed: ['05-17', '07-25'], jueves: true },
  aragon: { fixed: ['04-23'], jueves: true },
  castillayleon: { fixed: ['04-23'], jueves: true },
  canarias: { fixed: ['05-30'], jueves: true },
  baleares: { fixed: ['03-01'], jueves: true, lunes: true },
  murcia: { fixed: ['06-09'], jueves: true },
  asturias: { fixed: ['09-08'], jueves: true },
  paisvasco: { fixed: [], jueves: true, lunes: true },
  navarra: { fixed: [], jueves: true, lunes: true },
};

// Ciudad → comunidad (por si la ubicación guardada no trae la región).
const CITY = {
  madrid: 'madrid', alcala: 'madrid', getafe: 'madrid', mostoles: 'madrid', leganes: 'madrid',
  barcelona: 'cataluna', girona: 'cataluna', lleida: 'cataluna', tarragona: 'cataluna', badalona: 'cataluna', sabadell: 'cataluna', terrassa: 'cataluna',
  sevilla: 'andalucia', malaga: 'andalucia', granada: 'andalucia', cordoba: 'andalucia', cadiz: 'andalucia', almeria: 'andalucia', huelva: 'andalucia', jaen: 'andalucia',
  valencia: 'valenciana', alicante: 'valenciana', castellon: 'valenciana', elche: 'valenciana',
  'a coruna': 'galicia', coruna: 'galicia', vigo: 'galicia', santiago: 'galicia', ourense: 'galicia', lugo: 'galicia', pontevedra: 'galicia',
  zaragoza: 'aragon', huesca: 'aragon', teruel: 'aragon',
  valladolid: 'castillayleon', burgos: 'castillayleon', leon: 'castillayleon', salamanca: 'castillayleon', segovia: 'castillayleon',
  'las palmas': 'canarias', 'santa cruz de tenerife': 'canarias', palma: 'baleares', murcia: 'murcia', cartagena: 'murcia',
  oviedo: 'asturias', gijon: 'asturias', bilbao: 'paisvasco', 'san sebastian': 'paisvasco', donostia: 'paisvasco', vitoria: 'paisvasco',
  pamplona: 'navarra',
};
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function regionOf(location) {
  if (!location) return null;
  const byRegion = fold(location.region).replace(/[^a-z]/g, '');
  for (const k of Object.keys(REGIONS)) if (byRegion && byRegion.includes(k)) return k;
  if (/catalu|catalon/.test(byRegion)) return 'cataluna';
  if (/vasc|euskadi|basque/.test(byRegion)) return 'paisvasco';
  return CITY[fold(location.city)] || null;
}

// Domingo de Pascua (algoritmo de Meeus/Jones/Butcher), como 'YYYY-MM-DD'.
function easter(year) {
  const a = year % 19; const b = Math.floor(year / 100); const c = year % 100;
  const d = Math.floor(b / 4); const e = b % 4; const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3); const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4); const k = c % 4; const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
const shift = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

function isHoliday(day, region = null) {
  const md = day.slice(5);
  if (NATIONAL.includes(md)) return true;
  const e = easter(Number(day.slice(0, 4)));
  if (day === shift(e, -2)) return true; // Viernes Santo, nacional
  const r = REGIONS[region];
  if (!r) return false;
  if (r.fixed.includes(md)) return true;
  if (r.jueves && day === shift(e, -3)) return true;
  if (r.lunes && day === shift(e, 1)) return true;
  return false;
}

module.exports = { isHoliday, regionOf, easter, NATIONAL, REGIONS };
