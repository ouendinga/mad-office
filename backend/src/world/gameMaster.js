// Game Master por reglas: la IA propone y esto decide. Nada de lo que devuelve el modelo
// se usa sin pasar por aquí.

const { BLOCKS, toMinutes, fromMinutes } = require('./clock');
const { PLACES } = require('./places');

const HUMORES = ['euforico', 'contento', 'normal', 'mosqueado', 'agobiado', 'triste', 'dormido'];
const MAX_ACTIONS = 6;

function clean(text, max) {
  if (typeof text !== 'string') return '';
  // Sin saltos de línea ni caracteres de control; recorte duro.
  const t = text.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function fold(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function normHumor(h) {
  const f = fold(h);
  return HUMORES.includes(f) ? f : 'normal';
}

// names: [{id, name}] de los demás personajes.
function resolveCompanion(con, names, selfId) {
  if (!con) return null;
  // Si pone varios («Paco, Lucía y Toni»), vale el primero que exista.
  const f = fold(con).split(/\s*(?:,|\by\b)\s*/)[0];
  if (!f || f === 'nadie' || f === 'null') return null;
  const hit = names.find(n => n.id !== selfId && fold(n.name) === f)
    || names.find(n => n.id !== selfId && fold(n.name).split(' ')[0] === f.split(' ')[0]);
  return hit ? hit.id : null;
}

function validatePlan(raw, { block, names, selfId, remote = false, extra = false }) {
  const range = block === 'tarde' && extra ? { from: BLOCKS.tarde.from, to: BLOCKS.extra.to } : BLOCKS[block];
  if (!range) throw new Error(`bloque desconocido: ${block}`);
  const list = Array.isArray(raw) ? raw : [];
  const byMinute = new Map();

  for (const a of list) {
    if (!a || typeof a !== 'object') continue;
    let m = toMinutes(a.hora);
    if (m == null) continue;
    m = Math.min(Math.max(m, range.from), range.to - 15);
    if (byMinute.has(m)) continue;
    // Quien teletrabaja está en casa haga lo que haga; con un compañero, es una llamada.
    const lugar = remote ? 'casa' : (PLACES.includes(a.lugar) ? a.lugar : 'mesa');
    const conId = resolveCompanion(a.con, names, selfId);
    const que = clean(a.que, 90);
    if (!que) continue;
    const externo = conId ? '' : clean(a.externo, 60); // o compañero o alguien de fuera, no los dos
    byMinute.set(m, {
      min: m, lugar, con: conId, que, frase: clean(a.frase, 140),
      ...(externo ? { externo } : {}),
      ...(clean(a.piensa, 140) ? { piensa: clean(a.piensa, 140) } : {}),
    });
    if (byMinute.size >= MAX_ACTIONS) break;
  }

  const actions = [...byMinute.values()].sort((x, y) => x.min - y.min);
  // Como mucho dos pensamientos por bloque (aunque la IA meta más): el resto se descarta.
  let thoughts = 0;
  for (const a of actions) if (a.piensa && ++thoughts > 2) delete a.piensa;
  if (!actions.length || actions[0].min > range.from) {
    actions.unshift({
      min: range.from,
      lugar: remote ? 'casa' : (block === 'tarde' ? 'cafe' : 'mesa'),
      con: null,
      que: remote ? (block === 'tarde' ? 'Vuelve del sofá al portátil' : 'Abre el portátil en pijama') : (block === 'tarde' ? 'Vuelve de comer' : 'Llega a su mesa'),
      frase: '',
    });
  }
  return actions.slice(0, MAX_ACTIONS + 1).map(a => ({ ...a, hora: fromMinutes(a.min) }));
}

function validateWake(out, ctx) {
  const o = out && typeof out === 'object' ? out : {};
  const s = o.sueno && typeof o.sueno === 'object' ? o.sueno : null;
  // Dónde trabaja hoy: lo propone la IA y lo limitan las reglas (ctx.canRemote).
  const remote = ctx.decideMode ? (o.donde === 'casa' && ctx.canRemote === true) : !!ctx.remote;
  // Horas extra: solo en el turno de la tarde, si las pide Y las reglas las dejan.
  const extra = ctx.block === 'tarde' && o.horas_extra === true && ctx.canExtra === true;
  return {
    humor: normHumor(o.humor),
    plan: validatePlan(o.plan, { ...ctx, remote, extra }),
    extra,
    sueno: s ? { hace_caso: s.hace_caso === true, por_que: clean(s.por_que, 200) } : null,
    mode: remote ? 'remoto' : 'oficina',
    trayecto: remote ? '' : clean(o.trayecto, 160),
  };
}

function validateDiary(out) {
  const o = out && typeof out === 'object' ? out : {};
  const diario = clean(o.diario, 600);
  if (!diario) throw new Error('diario vacío');
  return { diario, humor: normHumor(o.humor), trayecto: clean(o.trayecto, 160) };
}

function validateProfile(out) {
  const o = out && typeof out === 'object' ? out : {};
  const arr = (v, n, max) => (Array.isArray(v) ? v : []).map(x => clean(x, max)).filter(Boolean).slice(0, n);
  const ficha = {
    puesto: clean(o.puesto, 60),
    personalidad: clean(o.personalidad, 300),
    manias: arr(o.manias, 3, 120),
    objetivo: clean(o.objetivo, 150),
    muletillas: arr(o.muletillas, 8, 60),
  };
  if (!ficha.puesto || !ficha.personalidad || !ficha.objetivo || ficha.muletillas.length < 3) {
    throw new Error('ficha incompleta');
  }
  return ficha;
}

function validateDreamHelp(out) {
  const o = out && typeof out === 'object' ? out : {};
  const propuestas = (Array.isArray(o.propuestas) ? o.propuestas : [])
    .map(x => clean(x, 200)).filter(Boolean).slice(0, 3);
  if (!propuestas.length) throw new Error('sin propuestas');
  return { propuestas, comentario: clean(o.comentario, 200) };
}

// Ficha editada a mano por su dueño: mismos límites que la generada.
function validateFichaEdit(ficha) {
  return validateProfile(ficha);
}

module.exports = {
  HUMORES, MAX_ACTIONS, clean, fold, normHumor, resolveCompanion, validatePlan, validateWake,
  validateDiary, validateProfile, validateDreamHelp, validateFichaEdit,
};
