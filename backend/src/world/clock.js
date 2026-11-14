// Reloj de la oficina: hora real de Madrid por defecto.
// Para probar: CLOCK_SPEED=60 (1 min real = 1 h de oficina) y CLOCK_START=2026-11-12T08:55:00+01:00.

const TZ = process.env.OFFICE_TZ || 'Europe/Madrid';

// Horario de una empresa: entrada, salida, comida y su duración (en minutos). Todo lo demás sale
// de aquí: la mañana va de la entrada a la comida, la tarde de la comida a la salida (empieza
// comiendo), las horas extra dos horas más y los trayectos media hora antes y después.
// Cada empresa tiene el suyo (makeSchedule); DEFAULT es el de 9 a 18 con comida a las 14:00.
const DEFAULT_HOURS = { start: 9 * 60, end: 18 * 60, lunch: 14 * 60, lunchMin: 60 };

function validateSchedule(n) {
  const ok = [n.start, n.end, n.lunch, n.lunchMin].every(Number.isInteger);
  if (!ok) return 'Horario incompleto.';
  if (n.start < 5 * 60 || n.end > 22 * 60) return 'La oficina abre entre las 05:00 y las 22:00.';
  if (n.end - n.start < 4 * 60) return 'La jornada tiene que durar al menos 4 horas.';
  if (n.lunchMin < 15 || n.lunchMin > 120) return 'La comida, entre 15 minutos y 2 horas.';
  if (n.lunch < n.start + 60 || n.lunch + n.lunchMin > n.end - 30) return 'La comida tiene que caer dentro de la jornada (no pegada a la entrada ni a la salida).';
  return null;
}

function makeSchedule(hours = DEFAULT_HOURS) {
  const sch = { SCHEDULE: { ...DEFAULT_HOURS }, BLOCKS: { manana: { label: 'mañana' }, tarde: { label: 'tarde' }, extra: { label: 'horas extra' } }, COMMUTE: {} };
  // Cambia EN SU SITIO, para que quien ya tiene la referencia vea lo nuevo.
  sch.set = next => {
    const n = { ...sch.SCHEDULE, ...next };
    const err = validateSchedule(n);
    if (err) return err;
    Object.assign(sch.SCHEDULE, n);
    Object.assign(sch.BLOCKS.manana, { from: n.start, to: n.lunch });
    Object.assign(sch.BLOCKS.tarde, { from: n.lunch, to: n.end });
    Object.assign(sch.BLOCKS.extra, { from: n.end, to: Math.min(n.end + 120, 23 * 60) });
    sch.COMMUTE.ida = n.start - 30;
    sch.COMMUTE.vuelta = n.end + 30;
    return null;
  };
  if (sch.set(hours)) sch.set(DEFAULT_HOURS);
  return sch;
}

const DEFAULT = makeSchedule();
const { SCHEDULE, BLOCKS, COMMUTE } = DEFAULT;
// Compatibilidad: cambia el horario por defecto.
function setSchedule(next) {
  return DEFAULT.set(next);
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

// Reloj de pruebas de una empresa (modo pruebas del dueño): parte del reloj común y lo mueve.
// reloj = { realAt, officeAt, speed }: en el instante común realAt la empresa marcaba officeAt, y
// desde ahí corre a speed. Sin reloj (null), la empresa va con la hora de todos.
function shiftedClock(base, reloj) {
  if (!reloj || !Number.isFinite(reloj.realAt) || !Number.isFinite(reloj.officeAt)) return base;
  const speed = Number(reloj.speed) > 0 ? Number(reloj.speed) : 1;
  return {
    speed: base.speed * speed,
    shifted: true,
    nowMs: () => reloj.officeAt + (base.nowMs() - reloj.realAt) * speed,
    realMs: officeMs => base.realMs(officeMs) / speed,
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

// Instante (ms) de una fecha y hora de Madrid: «2026-11-16», «09:00». Dos vueltas bastan para
// cuadrar el horario de verano.
function madridMs(date, hhmm) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const want = Date.UTC(y, m - 1, d, h, mi);
  let ms = want;
  for (let i = 0; i < 2; i++) {
    const p = parts(ms);
    const [py, pm, pd] = p.date.split('-').map(Number);
    ms += want - Date.UTC(py, pm - 1, pd, p.hour, p.minute);
  }
  return ms;
}

function isWorkday(weekday) {
  return weekday >= 1 && weekday <= 5;
}

// Bloque actual: 'manana' | 'tarde' | 'noche' (incluye fines de semana).
function blockOf(p, sch = DEFAULT) {
  const { BLOCKS } = sch;
  if (!isWorkday(p.weekday)) return 'noche';
  if (p.minutes >= BLOCKS.manana.from && p.minutes < BLOCKS.manana.to) return 'manana';
  if (p.minutes >= BLOCKS.tarde.from && p.minutes < BLOCKS.tarde.to) return 'tarde';
  return 'noche';
}

// Fase para la pantalla: en casa, de camino (media hora antes de entrar y después de salir) o en la oficina.
function phaseOf(p, sch = DEFAULT) {
  const { BLOCKS, COMMUTE } = sch;
  if (!isWorkday(p.weekday)) return 'casa';
  if (p.minutes >= COMMUTE.ida && p.minutes < BLOCKS.manana.from) return 'ida';
  if (p.minutes >= BLOCKS.manana.from && p.minutes < BLOCKS.tarde.to) return 'oficina';
  if (p.minutes >= BLOCKS.tarde.to && p.minutes < COMMUTE.vuelta) return 'vuelta';
  return 'casa';
}

// La mañana laborable en la que se despertará con el sueño que se mande ahora.
function nextMorning(p, sch = DEFAULT) {
  if (isWorkday(p.weekday) && p.minutes < sch.BLOCKS.manana.from) return p.date;
  let date = addDays(p.date, 1);
  let wd = (p.weekday % 7) + 1;
  while (!isWorkday(wd)) {
    date = addDays(date, 1);
    wd = (wd % 7) + 1;
  }
  return date;
}

// El sueño se escribe fuera del horario laboral (noches y fines de semana).
function dreamWindowOpen(p, sch = DEFAULT) {
  return blockOf(p, sch) === 'noche';
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
  TZ, DEFAULT, DEFAULT_HOURS, makeSchedule, validateSchedule, BLOCKS, COMMUTE, SCHEDULE, setSchedule, phaseOf, makeClock, shiftedClock, madridMs, parts, addDays, isWorkday, blockOf, nextMorning,
  dreamWindowOpen, toMinutes, fromMinutes,
};
