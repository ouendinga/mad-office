// Eventos de oficina: afterwork, talleres, team building, cumpleaños… Unos los propone la oficina
// por reglas (el afterwork de los viernes, el cumpleaños de cada uno) y otros los crea el admin desde
// Empresa. Quien está en la oficina decide si va según su carácter (vida social, mala leche) y una
// tirada; los que van se mueven al sitio del evento y lo comentan. Sin IA.

const { rng } = require('./autopilot');
const { traits } = require('./incidents');

const KINDS = {
  afterwork: { label: 'Afterwork', icon: '🍻', base: 0.6, frases: ['¡Por el viernes!', 'Una y me voy. (Mentira.)', '¿Quién pone música?', 'Esto debería ser obligatorio.'] },
  taller: { label: 'Taller', icon: '🧑‍🏫', base: 0.45, frases: ['Apunto todo. Bueno, casi.', '¿Esto entra en el examen?', 'Interesante… creo.'] },
  teambuilding: { label: 'Team building', icon: '🤝', base: 0.8, frases: ['¡Somos un equipo!', 'Esto es sinergia pura.', '¿Cuándo comemos?'] },
  cumple: { label: 'Cumpleaños', icon: '🎂', base: 0.75, frases: ['¡Felicidades!', '¿Hay tarta de chocolate?', 'Que cumplas muchos más.'] },
  charla: { label: 'Charla', icon: '🎤', base: 0.4, frases: ['Muy inspirador.', 'Me he perdido en la diapositiva tres.'] },
  otro: { label: 'Evento', icon: '🎉', base: 0.5, frases: ['¡Qué buen plan!', 'Esto no lo esperaba.'] },
};
const PLACES = ['terraza', 'descanso', 'reuniones', 'cafe'];
const TALLERES = ['Taller: Excel para valientes', 'Charla: cómo sobrevivir a una reunión', 'Taller de pósits avanzados',
  'Formación: el café y tú', 'Taller: correos que nadie lee'];

const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Los que propone la oficina para un día (laborable). weekday: 1 = lunes … 5 = viernes.
// chars: para los cumpleaños. Las horas, en el horario de la empresa (sch).
function autoEvents(day, weekday, chars, sch, companyId) {
  const out = [];
  const { BLOCKS } = sch;
  const end = BLOCKS.tarde.to;
  const [y, mo, d] = day.split('-').map(Number);
  if (weekday === 5) {
    out.push({ kind: 'afterwork', title: 'Afterwork de los viernes', place: 'terraza', from_min: end - 60, to_min: end + 30 });
  }
  // Un taller los miércoles de semana par (por número de semana del año).
  const doy = Math.floor((Date.UTC(y, mo - 1, d) - Date.UTC(y, 0, 1)) / 864e5);
  const week = Math.floor(doy / 7);
  if (weekday === 3 && week % 2 === 0) {
    out.push({ kind: 'taller', title: TALLERES[week / 2 % TALLERES.length], place: 'reuniones', from_min: BLOCKS.manana.to - 120, to_min: BLOCKS.manana.to - 60 });
  }
  // Team building el último jueves del mes.
  const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (weekday === 4 && d + 7 > lastDay) {
    out.push({ kind: 'teambuilding', title: 'Team building: la torre de clips más alta', place: 'terraza', from_min: end - 120, to_min: end - 30 });
  }
  // Cumpleaños: cada uno tiene su día (fijo, por sorteo). Si cae en finde, se celebra el viernes.
  for (const c of chars) {
    const bday = Math.floor(rng(`cumple|${companyId}|${c.id}`)() * 365);
    const shift = weekday === 5 ? [0, 1, 2] : [0];
    if (shift.some(s => (doy + s) % 365 === bday)) {
      out.push({ kind: 'cumple', title: `Cumple de ${c.name} (hay tarta)`, place: 'cafe', from_min: BLOCKS.manana.from + 120, to_min: BLOCKS.manana.from + 140, forId: c.id });
    }
  }
  return out;
}

// ¿Va esta persona a este evento? Determinista por persona y evento.
function attends(c, ev, stats = {}) {
  if (ev.forId === c.id) return true; // a su propio cumple, siempre
  const k = KINDS[ev.kind] || KINDS.otro;
  let p = k.base + ((stats.social ?? 3) - 3) * 0.08;
  const t = traits(c);
  if (t.malaLeche) p -= 0.2;
  return rng(`va|${ev.id}|${c.id}`)() < Math.max(0.05, Math.min(0.95, p));
}

function phrase(ev, c, minute) {
  const k = KINDS[ev.kind] || KINDS.otro;
  return k.frases[Math.floor(rng(`frase|${ev.id}|${c.id}|${Math.floor(minute / 10)}`)() * k.frases.length)];
}

// El sitio de verdad: el afterwork y el team building de la terraza se hacen dentro si llueve o hace frío.
function placeFor(ev, weather) {
  if (ev.place !== 'terraza' || !weather) return ev.place;
  return weather.code >= 51 || weather.temp < 8 ? 'descanso' : 'terraza';
}

module.exports = { KINDS, PLACES, autoEvents, attends, phrase, placeFor, hhmm };
