// Reloj de la oficina: hora real de Madrid por defecto.
// Para probar: CLOCK_SPEED=60 (1 min real = 1 h de oficina) y CLOCK_START=2026-11-12T08:55:00+01:00.

const TZ = process.env.OFFICE_TZ || 'Europe/Madrid';

// Horario de la oficina (configurable por el admin; por defecto, de 9 a 18 con una hora para
// comer a las 14:00). Todo lo demás sale de aquí: la mañana va de la entrada a la comida, la tarde
// de la comida a la salida (empieza comiendo), las horas extra dos horas más y los trayectos media
// hora antes y después. Se cambian EN SU SITIO para que quien ya tiene la referencia vea lo nuevo.
const SCHEDULE = { start: 9 * 60, end: 18 * 60, lunch: 14 * 60, lunchMin: 60 };
const BLOCKS = { manana: { label: 'mañana' }, tarde: { label: 'tarde' }, extra: { label: 'horas extra' } };
const COMMUTE = {};

function applySchedule() {
  Object.assign(BLOCKS.manana, { from: SCHEDULE.start, to: SCHEDULE.lunch });
  Object.assign(BLOCKS.tarde, { from: SCHEDULE.lunch, to: SCHEDULE.end });
  Object.assign(BLOCKS.extra, { from: SCHEDULE.end, to: Math.min(SCHEDULE.end + 120, 23 * 60) });
  COMMUTE.ida = SCHEDULE.start - 30;
  COMMUTE.vuelta = SCHEDULE.end + 30;
}
applySchedule();

// Valida y aplica un horario { start, end, lunch, lunchMin } en minutos. Devuelve el error, o null.
function setSchedule(next) {
  const n = { ...SCHEDULE, ...next };
  const ok = [n.start, n.end, n.lunch, n.lunchMin].every(Number.isInteger);
  if (!ok) return 'Horario incompleto.';
  if (n.start < 5 * 60 || n.end > 22 * 60) return 'La oficina abre entre las 05:00 y las 22:00.';
  if (n.end - n.start < 4 * 60) return 'La jornada tiene que durar al menos 4 horas.';
  if (n.lunchMin < 15 || n.lunchMin > 120) return 'La comida, entre 15 minutos y 2 horas.';
  if (n.lunch < n.start + 60 || n.lunch + n.lunchMin > n.end - 30) return 'La comida tiene que caer dentro de la jornada (no pegada a la entrada ni a la salida).';
  Object.assign(SCHEDULE, n);
  applySchedule();
  return null;
}

function makeClock({ speed = 1, start = null, now = () => Date.now() } = {}) {
  const realOrigin = now();
  const officeOrigin = start != null ? start : realOrigin;
  return {
    speed,
    nowMs() {
      return officeOrigin + (now() - realOrigin) * speed;
    },
    // Milisegundos reales que dura un intervalo de oficina.
    realMs(officeMs) {
      return officeMs / speed;
    },
  };
}

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
});
const WD = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function parts(ms) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const hour = Number(p.hour);
  const minute = Number(p.minute);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: WD[p.weekday],
    hour,
    minute,
    minutes: hour * 60 + minute,
    hhmm: `${p.hour}:${p.minute}`,
  };
}

function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function isWorkday(weekday) {
  return weekday >= 1 && weekday <= 5;
}

// Bloque actual: 'manana' | 'tarde' | 'noche' (incluye fines de semana).
function blockOf(p) {
  if (!isWorkday(p.weekday)) return 'noche';
  if (p.minutes >= BLOCKS.manana.from && p.minutes < BLOCKS.manana.to) return 'manana';
  if (p.minutes >= BLOCKS.tarde.from && p.minutes < BLOCKS.tarde.to) return 'tarde';
  return 'noche';
}

// Fase para la pantalla: en casa, de camino (media hora antes de entrar y después de salir) o en la oficina.
function phaseOf(p) {
  if (!isWorkday(p.weekday)) return 'casa';
  if (p.minutes >= COMMUTE.ida && p.minutes < BLOCKS.manana.from) return 'ida';
  if (p.minutes >= BLOCKS.manana.from && p.minutes < BLOCKS.tarde.to) return 'oficina';
  if (p.minutes >= BLOCKS.tarde.to && p.minutes < COMMUTE.vuelta) return 'vuelta';
  return 'casa';
}

// La mañana laborable en la que se despertará con el sueño que se mande ahora.
function nextMorning(p) {
  if (isWorkday(p.weekday) && p.minutes < BLOCKS.manana.from) return p.date;
  let date = addDays(p.date, 1);
  let wd = (p.weekday % 7) + 1;
  while (!isWorkday(wd)) {
    date = addDays(date, 1);
    wd = (wd % 7) + 1;
  }
  return date;
}

// El sueño se escribe fuera del horario laboral (noches y fines de semana).
function dreamWindowOpen(p) {
  return blockOf(p) === 'noche';
}

function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function fromMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

module.exports = {
  TZ, BLOCKS, COMMUTE, SCHEDULE, setSchedule, phaseOf, makeClock, parts, addDays, isWorkday, blockOf, nextMorning,
  dreamWindowOpen, toMinutes, fromMinutes,
};
