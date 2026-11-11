// Reloj de la oficina: hora real de Madrid por defecto.
// Para probar: CLOCK_SPEED=60 (1 min real = 1 h de oficina) y CLOCK_START=2026-11-12T08:55:00+01:00.

const TZ = process.env.OFFICE_TZ || 'Europe/Madrid';

const BLOCKS = {
  manana: { from: 9 * 60, to: 14 * 60, label: 'mañana' },
  tarde: { from: 14 * 60, to: 18 * 60, label: 'tarde' },
};

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
  TZ, BLOCKS, makeClock, parts, addDays, isWorkday, blockOf, nextMorning,
  dreamWindowOpen, toMinutes, fromMinutes,
};
