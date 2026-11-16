// Conversaciones que se VEN: cuando dos o más están juntos (comiendo, en el café, de visita a la mesa
// de otro, en el ping-pong, en una reunión…), de vez en cuando se ponen a hablar. Bocadillos
// ALTERNOS: uno abre, otro responde; 2-4 frases. Sin IA: las frases salen de reglas, de las
// muletillas de cada ficha y del contexto (qué hacen, incidentes abiertos, eventos del día, el tiempo).
//
// Ritmo de oficina normal: una conversación por grupo a la vez, cada frase unos segundos y, al
// acabar, un buen rato de silencio. Va en tiempo REAL (para que dé tiempo a leer), no de oficina.
//
// Al feed solo va UNA línea por conversación, y no todas: solo si tienen tema (un incidente, un
// evento, el tiempo, la comida) y como mucho una por sitio cada `FEED_EVERY_MIN` minutos de oficina.
// Va con su sitio y su minuto, así que la «oyen» quienes estaban allí (hearing.js).

const { rng } = require('./autopilot');

const LINE_MS = 4200; // lo que dura cada bocadillo
const WARMUP_MS = [9000, 16000]; // al juntarse, primero el bocadillo de llegada (BUBBLE_MS) y luego charla
const QUIET_MS = [30000, 80000]; // silencio entre una conversación y la siguiente del mismo grupo
const FEED_EVERY_MIN = 45;
const MAX_SPEAKERS = 3;
// Sitios donde se habla (en el baño y en servidores, cada uno a lo suyo).
const TALK_PLACES = new Set(['cafe', 'terraza', 'descanso', 'reuniones', 'recepcion', 'despacho']);
const PLACE_NAME = {
  cafe: 'en la cocina', terraza: 'en la terraza', descanso: 'en la zona chill', reuniones: 'en la sala de reuniones',
  recepcion: 'en recepción', despacho: 'en el despacho', mesa: 'en su mesa',
};

const between = (r, [a, b]) => a + Math.floor(r() * (b - a));
const pick = (r, list) => list[Math.floor(r() * list.length)];

// --- Guiones por tema. a: quien abre · b: respuesta · c: remate (el primero o un tercero) ---
// {B} es el nombre de a quién se habla; {food}, lo que come; {inc}, el incidente; {ev}, el evento.
const FOOD_NAME = {
  pasta: 'macarrones', ensalada: 'ensalada', arroz: 'arroz', lentejas: 'lentejas', tortilla: 'tortilla',
  pizza: 'pizza fría', sushi: 'sushi', fideos: 'fideos', bocata: 'bocata', fruta: 'fruta',
};

const SCRIPTS = {
  comida: [
    { a: ['¿Eso son {food}? Huele que alimenta.', '¿Qué traes hoy, {B}?', 'Mmm, {food}. Te lo cambio por lo mío.'],
      b: ['{food} de mi madre. No se comparte.', 'Restos de ayer. Los mejores.', 'Lo que había en la nevera. Sin preguntas.'],
      c: ['Mañana traigo croquetas. Prometido.', 'Pues yo el lunes empiezo la dieta.', 'Esto en un restaurante serían 15 euros.'] },
    { a: ['¿Os habéis fijado en que el micro tiene cola de 20 minutos?', '¿Quién ha dejado el táper de la semana pasada en la nevera?'],
      b: ['Yo calenté a las 13:58. Estrategia.', 'No he sido yo. Creo.', 'Eso ya tiene vida propia.'],
      c: ['Habría que poner un turno con Excel.', 'Lo hablamos en la reunión de seguimiento.'] },
    { a: ['¿Postre o directamente café?', '¿Bajamos luego a por un helado?'],
      b: ['Las dos cosas. Es martes. O lo que sea.', 'Yo solo café. Bueno, y una galleta.', 'Si hay helado, voy.'],
      c: ['Eso, que la tarde es larga.', 'Me apunto a todo.'] },
  ],
  cafe: [
    { a: ['¿Qué tal el finde, {B}?', '¿Ya es viernes? Dime que sí.', 'Este café sabe a lunes.'],
      b: ['Corto. Siempre es corto.', 'Ojalá. Es lo que hay.', 'Todos saben a lunes.'],
      c: ['Pues aguanta, que queda poco.', 'Otro café y lo arreglamos.', 'Así es la vida en la oficina.'] },
    { a: ['¿Has visto el correo del jefe?', '¿Tú te has enterado de lo de la reunión de las cinco?'],
      b: ['Lo he abierto y lo he cerrado. Sin leer.', '¿Qué reunión? No me asustes.', 'Lo he leído dos veces y sigo igual.'],
      c: ['Pues eso, que podría ser un correo.', 'Mejor no preguntes.'] },
  ],
  terraza: [
    { a: ['Aquí fuera se piensa mejor.', 'Cinco minutos de aire y vuelvo a ser persona.'],
      b: ['Y no se oye el teclado de nadie.', 'Ojalá trabajar aquí todo el día.'],
      c: ['Hasta que llueva.', 'Propongo mover la oficina aquí.'] },
  ],
  descanso: [
    { a: ['¿Qué ponen en la tele?', 'Este puf me conoce mejor que mi colchón.'],
      b: ['Un documental de pingüinos. Muy de oficina.', 'No te duermas, que te conozco.'],
      c: ['Cinco minutos más y vuelvo.', 'Esto es productividad, ¿eh?'] },
  ],
  reunion: [
    { a: ['¿Cuál era el objetivo de esta reunión?', 'Vale, ¿quién comparte pantalla?', 'Propongo una reunión para preparar la reunión.'],
      b: ['Alinearnos. Creo.', 'Yo no, que tengo 40 pestañas abiertas.', 'Secundo. Con orden del día.'],
      c: ['Lo dejamos en un correo, ¿vale?', 'Pues hacemos un seguimiento la semana que viene.', 'Apuntado. Siguiente punto.'] },
  ],
  visita: [
    { a: ['Oye, {B}, ¿tienes un minuto?', '{B}, una cosita rápida…', 'Perdona que te moleste, {B}…'],
      b: ['Un minuto de los de verdad, ¿no?', 'Dime, que estoy a mil.', 'Si es para el Excel, no estoy.'],
      c: ['Nada, que ya está. Gracias.', 'Te lo mando por correo mejor.', 'Era una tontería, ya me voy.'] },
  ],
  pingpong: [
    { a: ['¡Punto mío!', 'Ese saque ha sido ilegal.', '¡Va, la última!'],
      b: ['Ha tocado red, repite.', '¡Revancha!', 'Eso no ha botado.'],
      c: ['Al mejor de cinco.', 'Lo anoto en la pizarra.', 'Esto lo decide el VAR.'] },
  ],
  consola: [
    { a: ['¡No me tires el plátano!', 'Dame el mando bueno.', 'Esta pantalla me la paso.'],
      b: ['Esto es formación de equipo.', 'Te dejo ganar por respeto.', 'El mando está roto, por eso pierdo.'],
      c: ['Una más y volvemos.', 'Que no se entere el jefe.'] },
  ],
  evento: [
    { a: ['¿Esto cuenta como horas de trabajo?', 'Buen ambiente, ¿eh?'],
      b: ['Si hay picoteo, sí.', 'El mejor rato de la semana.'],
      c: ['Que se repita.', 'Pues la próxima, con música.'] },
  ],
};

// Por tema del contexto (van antes que el guion del sitio si tocan).
const TOPICS = {
  incidente: { a: ['¿Os habéis enterado? {inc}.', 'Te cuento: {inc}. De película.', '¿Has visto? {inc}. Increíble.'],
    b: ['No hablo de eso hasta que lo arreglen.', 'Yo no he sido, que conste.', 'Ya tardaba en pasar algo.', 'Esto en otra empresa no pasa.'],
    c: ['Pues habrá que llamar a alguien.', 'Le hacemos una foto para el grupo.', 'Con esto ya tenemos tema para toda la semana.'] },
  evento: { a: ['¿Vas a lo de {ev}?', 'Oye, lo de {ev}, ¿quién se apunta?'],
    b: ['Si hay comida, voy.', 'Depende de cómo vaya la tarde.', 'Me lo ha dicho todo el mundo. Voy.'],
    c: ['Pues nos vemos allí.', 'Guárdame sitio.'] },
  lluvia: { a: ['Vaya día de perros.', '¿Has visto cómo llueve?'],
    b: ['Yo he venido nadando.', 'Mi paraguas no ha sobrevivido.', 'Hoy no salgo ni a por café.'],
    c: ['Y luego dicen que en España siempre hace sol.', 'Mañana teletrabajo. Avisado quedas.'] },
  nieve: { a: ['¡Está nevando!', '¿Habéis visto la nieve?'],
    b: ['Si cuaja, me voy a casa a hacer un muñeco.', 'Ya verás el tráfico a la vuelta.'],
    c: ['Hoy nadie trabaja, solo mira por la ventana.'] },
  calor: { a: ['Qué calor hace, por favor.', 'Aquí dentro se puede freír un huevo.'],
    b: ['El aire está puesto de adorno.', 'Yo ya he pedido un ventilador al jefe.'],
    c: ['Propongo jornada en la piscina.'] },
  frio: { a: ['Qué frío hace hoy.', 'Llevo tres capas y sigo helado.'],
    b: ['Ponte junto a los servidores, que calientan.', 'El café hoy es por supervivencia.'],
    c: ['Mañana me traigo la manta.'] },
};

// Para el remate genérico si el guion no lo trae.
const CLOSERS = ['Bueno, a seguir.', 'Pues eso.', 'Ya hablamos.', 'Venga, que no nos vean.', 'Jajaja, total.'];

// El tiempo de fuera, si da para hablar.
function weatherTopic(w) {
  if (!w) return null;
  const c = Number(w.code);
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'nieve';
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95) return 'lluvia';
  if (Number(w.temp) >= 30) return 'calor';
  if (Number(w.temp) <= 5) return 'frio';
  return null;
}

// Incidente en palabras: el título sin el emoji y hasta el primer punto (va como frase entera: no se
// pasa a minúsculas, que el título suele empezar por un nombre).
function incidentText(inc) {
  const t = String(inc.title || '').replace(/^\S+\s/, '').split('.')[0].trim();
  return t || 'ha pasado algo en la oficina';
}

// Quién está con quién ahora. entries: [{ v, a }] con v = la vista del personaje (tras repartir las
// zonas) y a = su acción en curso. Devuelve [{ key, kind, lugar, ids }].
function groupsOf(entries) {
  const byId = new Map(entries.map(e => [e.v.id, e]));
  const out = [];
  const taken = new Set();
  // Parejas: de visita a la mesa de otro (si el otro está), ping-pong y consola a dos.
  for (const { v, a } of entries) {
    if (taken.has(v.id) || v.mode !== 'oficina') continue;
    const m = a && a.micro;
    const kind = m && (m.kind === 'pingpong' || m.kind === 'consola') ? m.kind : v.lugar === 'visita' ? 'visita' : null;
    const con = a && a.con;
    if (!kind || con == null || taken.has(con)) continue;
    const other = byId.get(con);
    if (!other || other.v.mode !== 'oficina') continue;
    const ids = [v.id, con];
    ids.forEach(id => taken.add(id));
    out.push({ key: `${kind}|${Math.min(...ids)}|${Math.max(...ids)}`, kind, lugar: kind === 'visita' ? 'mesa' : 'descanso', ids, host: con });
  }
  // Salas: todos los que están en el mismo sitio.
  const rooms = new Map();
  for (const { v } of entries) {
    if (taken.has(v.id) || v.mode !== 'oficina' || v.visitor || !TALK_PLACES.has(v.lugar)) continue;
    if (!rooms.has(v.lugar)) rooms.set(v.lugar, []);
    rooms.get(v.lugar).push(v.id);
  }
  // En una sala llena no habla todo el mundo con todo el mundo: corrillos de 2-4, de vecinos (los
  // huecos de cada sala se reparten por id, así que ids seguidos están al lado).
  for (const [lugar, list] of rooms) {
    const ids = list.sort((x, y) => x - y);
    if (ids.length < 2) continue;
    const chunks = [];
    for (let i = 0; i < ids.length; i += 3) chunks.push(ids.slice(i, i + 3));
    if (chunks.length > 1 && chunks[chunks.length - 1].length === 1) chunks[chunks.length - 2].push(chunks.pop()[0]);
    chunks.forEach((c, k) => out.push({ key: `sala|${lugar}|${k}`, kind: 'sala', lugar, ids: c }));
  }
  return out;
}

// La conversación entera, de una vez (determinista con la semilla). members: [{ id, name, muletillas,
// eat, evento }]; ctx: { incidents, events, weather }. Devuelve { topic, context, lines: [{ id, text }] }.
function buildConversation(group, members, ctx, seed) {
  const r = rng(seed);
  // Quién habla: hasta tres, en orden al azar.
  const pool = members.slice();
  const speakers = [];
  while (pool.length && speakers.length < MAX_SPEAKERS) speakers.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  const [A, B] = speakers;
  const eating = members.filter(m => m.eat);
  const context = group.kind === 'pingpong' || group.kind === 'consola' || group.kind === 'visita' ? group.kind
    : members.some(m => m.evento) ? 'evento'
      : eating.length ? 'comida'
        : group.lugar === 'reuniones' || group.lugar === 'despacho' || group.lugar === 'recepcion' ? 'reunion'
          : group.lugar;

  // Tema: a veces el del contexto de la oficina (incidente, evento, el tiempo), si lo hay.
  const topics = [];
  const near = (ctx.incidents || []).filter(i => !i.place || i.place === 'oficina' || i.place === group.lugar);
  const anyInc = near.length ? near : (ctx.incidents || []);
  if (anyInc.length) topics.push(['incidente', near.length ? 0.6 : 0.35, { inc: incidentText(pick(r, anyInc)) }]);
  const evs = (ctx.events || []).filter(e => !e.done);
  if (evs.length && context !== 'evento') topics.push(['evento', 0.3, { ev: String(pick(r, evs).title || 'lo de hoy').toLowerCase() }]);
  const wt = weatherTopic(ctx.weather);
  if (wt && context !== 'pingpong' && context !== 'consola') topics.push([wt, 0.25, {}]);
  let topic = null;
  let vars = {};
  for (const [t, p, v] of topics) if (r() < p) { topic = t; vars = v; break; }
  const script = topic ? TOPICS[topic] : pick(r, SCRIPTS[context] || SCRIPTS.cafe);

  const food = (A && A.eat) || (B && B.eat) || eating[0] && eating[0].eat;
  const fill = (text, speaker, listener) => text
    .replace(/\{B\}/g, listener ? listener.name : 'tú')
    .replace(/\{food\}/g, food ? FOOD_NAME[food.food] || food.food : 'eso')
    .replace(/\{inc\}/g, vars.inc || 'lo de hoy')
    .replace(/\{ev\}/g, vars.ev || 'lo de hoy')
    .replace(/^./, ch => ch.toUpperCase());
  // Una muletilla de vez en cuando (más en las respuestas: es lo que uno suelta sin pensar).
  const say = (speaker, list, listener, mule) => {
    const own = speaker.muletillas || [];
    const text = own.length && r() < mule ? pick(r, own) : fill(pick(r, list), speaker, listener);
    // Quien habla con la boca llena, se nota.
    return speaker.eat && speaker.eat.style === 'habla' ? `(ñam) ${text}` : text;
  };

  const n = 2 + Math.floor(r() * 3); // 2-4 frases
  const C = speakers[2] || A;
  const lines = [{ id: A.id, text: say(A, script.a, B, 0.1) }, { id: B.id, text: say(B, script.b, A, 0.35) }];
  if (n >= 3) lines.push({ id: C.id, text: say(C, script.c || CLOSERS, B, 0.3) });
  if (n >= 4) lines.push({ id: B.id, text: say(B, CLOSERS, C, 0.4) });
  return { topic: topic || null, context, lines };
}

class Chatter {
  constructor({ companyId = 1 } = {}) {
    this.companyId = companyId;
    this.convs = new Map(); // grupo -> { lines, startedAt, ids, n }
    this.nextAt = new Map(); // grupo -> cuándo puede empezar la siguiente (ms reales)
    this.count = new Map(); // grupo|día -> nº de conversaciones (para la semilla)
    this.lastFeed = new Map(); // sitio -> minuto de oficina de la última línea en el feed
  }

  // Cada tick, con la vista ya montada. entries: [{ v, a, c }] (c = el personaje con su ficha).
  // ctx: { day, minutes, incidents, events, weather, eatOf(id) }. Pinta en la vista los bocadillos
  // de quien habla ahora y devuelve las líneas para el feed: [{ id, con, lugar, text }].
  update(entries, nowMs, ctx) {
    const posts = [];
    const groups = groupsOf(entries);
    const live = new Set(groups.map(g => g.key));
    for (const k of [...this.convs.keys()]) if (!live.has(k)) this.convs.delete(k);
    for (const k of [...this.nextAt.keys()]) if (!live.has(k)) this.nextAt.delete(k);
    const byId = new Map(entries.map(e => [e.v.id, e]));

    for (const g of groups) {
      let conv = this.convs.get(g.key);
      // Si alguien de la conversación se ha ido, se corta.
      if (conv && conv.ids.some(id => !g.ids.includes(id))) {
        this.convs.delete(g.key);
        this.nextAt.set(g.key, nowMs + QUIET_MS[0]);
        conv = null;
      }
      if (!conv) {
        const countKey = `${g.key}|${ctx.day}`;
        const n = this.count.get(countKey) || 0;
        const r = rng(`charla|${this.companyId}|${ctx.day}|${g.key}|${n}|espera`);
        if (!this.nextAt.has(g.key)) this.nextAt.set(g.key, nowMs + between(r, WARMUP_MS));
        if (nowMs < this.nextAt.get(g.key)) continue;
        const members = g.ids.map(id => byId.get(id)).map(({ v, a, c }) => ({
          id: v.id, name: v.name, eat: v.eat || null, evento: !!(a && a.evento),
          muletillas: (c && c.ficha && Array.isArray(c.ficha.muletillas)) ? c.ficha.muletillas : [],
        }));
        const built = buildConversation(g, members, ctx, `charla|${this.companyId}|${ctx.day}|${g.key}|${n}`);
        this.count.set(countKey, n + 1);
        conv = { ...built, ids: [...new Set(built.lines.map(l => l.id))], startedAt: nowMs };
        this.convs.set(g.key, conv);
        const post = this.feedLine(g, conv, members, ctx);
        if (post) posts.push(post);
      }
      const i = Math.floor((nowMs - conv.startedAt) / LINE_MS);
      if (i >= conv.lines.length) {
        this.convs.delete(g.key);
        const r = rng(`charla|${this.companyId}|${ctx.day}|${g.key}|${this.count.get(`${g.key}|${ctx.day}`)}|silencio`);
        this.nextAt.set(g.key, nowMs + between(r, QUIET_MS));
        continue;
      }
      // Mientras se habla, los bocadillos de este grupo son los de la conversación (y no otros).
      const line = conv.lines[i];
      for (const id of g.ids) {
        const v = byId.get(id).v;
        v.bubble = id === line.id ? line.text : null;
        v.talk = { group: g.key, speaking: id === line.id, to: id === line.id ? conv.ids.find(x => x !== id) ?? null : line.id };
      }
    }
    return posts;
  }

  // Una línea para el feed, solo si la conversación tiene tema y no se ha contado nada de ese sitio hace poco.
  feedLine(g, conv, members, ctx) {
    if (!conv.topic && conv.context !== 'comida' && conv.context !== 'evento') return null;
    const where = g.kind === 'sala' ? g.lugar : g.key;
    const last = this.lastFeed.get(where);
    if (last != null && last.day === ctx.day && ctx.minutes - last.min < FEED_EVERY_MIN) return null;
    this.lastFeed.set(where, { day: ctx.day, min: ctx.minutes });
    const names = conv.ids.map(id => (members.find(m => m.id === id) || {}).name).filter(Boolean);
    const who = names.length > 2 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names.join(' y ');
    const [l1, l2] = conv.lines;
    const host = members.find(m => m.id === g.host);
    const place = g.kind === 'visita' ? `en la mesa de ${host ? host.name : 'alguien'}` : g.kind === 'sala' ? PLACE_NAME[g.lugar] || '' : g.kind === 'consola' ? 'a la consola' : 'en el ping-pong';
    return {
      id: l1.id, con: l2.id, lugar: g.lugar,
      text: `💬 ${who}, ${place}: «${l1.text}» — «${l2.text}»`,
    };
  }
}

module.exports = { Chatter, groupsOf, buildConversation, weatherTopic, LINE_MS, WARMUP_MS, QUIET_MS, FEED_EVERY_MIN, SCRIPTS, TOPICS };
