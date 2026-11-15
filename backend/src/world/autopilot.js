// Piloto automático: el día sin IA. No gasta nada. Lo usa el personaje mientras su turno
// está en cola, si no hay despertador encendido o si se ha gastado el tope.

const { fromMinutes, DEFAULT } = require('./clock');

// Generador determinista por personaje y día, para que el plan no cambie al reiniciar.
function rng(seedStr) {
  let h = 2166136261;
  for (const c of seedStr) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Lo que se hace en la mesa (va cambiando para que el feed no repita siempre lo mismo).
const AT_DESK = ['Trabaja (más o menos)', 'Hace como que contesta correos', 'Se pelea con una hoja de cálculo',
  'Escribe un correo con mucho cariño (y copia a todos)', 'Prepara la reunión de mañana', 'Busca un archivo que juraría que guardó',
  'Teclea muy fuerte para que se note', 'Lucha contra la modorra'];

// Salidas de la mesa, por sitio.
const OUTINGS = {
  cafe: ['Café y cotilleo en la cocina', 'Segundo café (o tercero)', 'Asalta la máquina de snacks'],
  terraza: ['Toma el aire en la terraza', 'Llamada «importante» en la terraza'],
  reuniones: ['Reunión que podía ser un correo', 'Reunión de seguimiento del seguimiento', 'Lluvia de ideas (llovizna)'],
  lavabo: ['Escapada estratégica', 'Se pierde un rato'],
  recepcion: ['Va a ver si ha llegado un paquete', 'Recoge a una visita'],
  servidores: ['Va a mirar por qué parpadea una luz', 'Reinicia algo «por si acaso»'],
  descanso: ['Cinco minutos en el puf', 'Mira qué hay en la tele de la zona chill'],
  despacho: ['Le llaman al despacho del jefe'],
};

// El sitio «suyo» según el cargo: el de Sistemas pasa por servidores, la de Ventas, por reuniones…
const FAVORITE = [
  [/sistem|devops|infra|soporte|\bit\b|redes|backend|servidor/i, 'servidores'],
  [/comercial|ventas|account|cliente|marketing|preventa|negocio/i, 'reuniones'],
  [/recepci|administra|oficina|rrhh|recursos humanos/i, 'recepcion'],
  [/ceo|cto|cfo|coo|director|jefe|gerente|manager/i, 'reuniones'],
];
function favoriteOf(character) {
  const t = `${character.position_title || ''} ${(character.ficha && character.ficha.puesto) || ''}`;
  for (const [re, place] of FAVORITE) if (re.test(t)) return place;
  return null;
}

// Las horas se escriben en el horario por defecto (9-14 y 14-18, comida de 14:00 a 15:00) y se
// llevan al configurado proporcionalmente.
function toSchedule(block, min, { BLOCKS, SCHEDULE } = DEFAULT) {
  if (block === 'manana') {
    return Math.round(BLOCKS.manana.from + ((min - 540) / 300) * (BLOCKS.manana.to - BLOCKS.manana.from));
  }
  if (min < 900) return Math.round(BLOCKS.tarde.from + ((min - 840) / 60) * SCHEDULE.lunchMin);
  const after = BLOCKS.tarde.from + SCHEDULE.lunchMin;
  return Math.round(after + ((min - 900) / 180) * (BLOCKS.tarde.to - after));
}

function pick(v, i) {
  return Array.isArray(v) ? v[i % v.length] : v;
}

// Día de teletrabajo sin IA: todo en casa.
const REMOTE = {
  manana: ['Abre el portátil en pijama', 'Café en su taza de casa', 'Trabaja con la tele de fondo', 'Pone la lavadora entre reunión y reunión', 'Contesta correos desde el sofá'],
  tarde: ['Come en la cocina de casa', 'Lucha contra la siesta', 'Pasea al perro (o al vecino)', 'Recta final con la cámara apagada'],
};

// Salidas del bloque: [desde, hasta) en minutos por defecto, sin solaparse, con su sitio.
function outingsFor(block, r, fav) {
  const out = [];
  const add = (from, dur, lugar) => {
    const to = from + dur;
    if (out.some(o => from < o.to + 5 && to + 5 > o.from)) return;
    out.push({ from, to, lugar });
  };
  if (block === 'manana') {
    // El café de media mañana, cada uno a su hora (9:40-11:30).
    add(580 + Math.floor(r() * 110), 10 + Math.floor(r() * 16), r() < 0.7 ? 'cafe' : 'terraza');
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const lugar = fav && r() < 0.5 ? fav : pick(['reuniones', 'lavabo', 'recepcion', 'servidores', 'descanso', 'cafe', 'terraza'], Math.floor(r() * 7));
      add(600 + Math.floor(r() * 200), 8 + Math.floor(r() * 30), lugar);
    }
  } else {
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const lugar = fav && r() < 0.5 ? fav : pick(['reuniones', 'lavabo', 'descanso', 'despacho', 'cafe', 'terraza', 'servidores'], Math.floor(r() * 7));
      add(915 + Math.floor(r() * 130), 8 + Math.floor(r() * 25), lugar);
    }
  }
  return out.sort((a, b) => a.from - b.from);
}

function autopilotPlan(character, day, block, { remote = false, sch = DEFAULT } = {}) {
  const { BLOCKS } = sch;
  const r = rng(`${character.id}|${day}|${block}`);
  const muletillas = (character.ficha && character.ficha.muletillas) || [];
  const frase = () => (muletillas.length && r() < 0.5 ? muletillas[Math.floor(r() * muletillas.length)] : '');
  const desk = () => AT_DESK[Math.floor(r() * AT_DESK.length)];
  const steps = []; // [min por defecto, lugar, que]
  if (block === 'manana') {
    steps.push([540, 'mesa', 'Llega y enciende el ordenador']);
  } else {
    // La comida, cada uno a su hora dentro de la franja (unos bajan en punto, otros acaban algo antes).
    const lunchAt = 840 + Math.floor(r() * 20);
    if (lunchAt > 840) steps.push([840, 'mesa', 'Termina lo que tenía entre manos']);
    steps.push([lunchAt, pick(['cafe', 'terraza', 'cafe'], Math.floor(r() * 3)), pick(['Come de táper', 'Come al aire libre', 'Calienta el táper en el micro'], Math.floor(r() * 3))]);
    steps.push([900 + Math.floor(r() * 10), 'mesa', 'Vuelve de comer y lucha contra la modorra']);
  }
  for (const o of outingsFor(block, r, favoriteOf(character))) {
    const list = OUTINGS[o.lugar] || ['Se da una vuelta'];
    steps.push([o.from, o.lugar, list[Math.floor(r() * list.length)]]);
    steps.push([o.to, 'mesa', desk()]);
  }
  if (block === 'tarde') steps.push([1050 + Math.floor(r() * 15), 'mesa', 'Recta final del día']);

  const seen = new Set();
  return steps
    .map(([m, lugar, que]) => [Math.min(Math.max(toSchedule(block, m, sch), BLOCKS[block].from), BLOCKS[block].to - 5), lugar, que])
    .sort((a, b) => a[0] - b[0])
    .filter(([m]) => (seen.has(m) ? false : seen.add(m)))
    .map(([min, lugar, que], i) => {
      if (remote) return { min, hora: fromMinutes(min), lugar: 'casa', con: null, que: REMOTE[block][i % REMOTE[block].length], frase: frase() };
      return { min, hora: fromMinutes(min), lugar, con: null, que, frase: frase() };
    });
}

module.exports = { autopilotPlan, rng };
