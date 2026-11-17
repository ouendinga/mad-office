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

// --- Guiones. Cada hilo es una pregunta (o comentario) con SUS respuestas y SUS remates: todo
// lo de `b` contesta a cualquier frase de `a`, y todo lo de `c` cierra cualquier par a-b del mismo hilo
// (antes se sorteaban por separado y salía «¿Qué tal el finde?» — «Todos saben a lunes»).
// {B} es el nombre de a quién se habla; {food}, lo que come; {inc}, el incidente; {ev}, el evento.
const FOOD_NAME = {
  pasta: 'macarrones', ensalada: 'ensalada', arroz: 'arroz', lentejas: 'lentejas', tortilla: 'tortilla',
  pizza: 'pizza fría', sushi: 'sushi', fideos: 'fideos', bocata: 'bocata', fruta: 'fruta',
};

const SCRIPTS = {
  comida: [
    { a: ['¿Eso son {food}? Huele que alimenta.', 'Mmm, {food}. Qué buena pinta.'],
      b: ['De mi madre. No se comparte.', 'Restos de ayer. Los mejores.', 'Lo he hecho yo. No preguntes cómo.'],
      c: ['Mañana traigo croquetas. Prometido.', 'Esto en un restaurante serían 15 euros.', 'Pues yo con mi ensalada triste.'] },
    { a: ['¿Qué traes hoy, {B}?', '¿Qué hay de comer hoy, {B}?'],
      b: ['{food}. Lo que había en la nevera.', '{food}. Y de postre, nada.', '{food}, como siempre.'],
      c: ['Mañana traigo croquetas. Prometido.', 'Pues yo el lunes empiezo la dieta.'] },
    { a: ['¿Os habéis fijado en la cola del micro?', 'El micro hoy tiene cola de 20 minutos.'],
      b: ['Yo he calentado a las 13:58. Estrategia.', 'Por eso como frío.', 'Hay quien calienta tres táperes seguidos.'],
      c: ['Habría que poner un turno con Excel.', 'Lo hablamos en la reunión de seguimiento.'] },
    { a: ['¿Quién ha dejado el táper de la semana pasada en la nevera?', 'Algo huele raro en la nevera.'],
      b: ['No he sido yo. Creo.', 'Eso ya tiene vida propia.', 'Yo no abro esa nevera desde el martes.'],
      c: ['Que alguien llame a sanidad.', 'Lo tiro yo el viernes. O no.'] },
    { a: ['¿Postre o directamente café?', '¿Bajamos luego a por un helado?'],
      b: ['Las dos cosas. Es lo que pide el cuerpo.', 'Yo solo café. Bueno, y una galleta.', 'Si hay helado, voy.'],
      c: ['Eso, que la tarde es larga.', 'Me apunto a todo.'] },
  ],
  cafe: [
    { a: ['¿Qué tal el finde, {B}?', '¿Qué hiciste el finde, {B}?'],
      b: ['Corto. Siempre es corto.', 'Sofá y series. Perfecto.', 'Una boda. Aún me duelen los pies.', 'Mudanza de mi cuñado. No preguntes.'],
      c: ['Pues el próximo, más.', 'Qué envidia.', 'Y vuelta a la rutina.'] },
    { a: ['Este café sabe a lunes.', 'Este café está más aguado que ayer.'],
      b: ['Todos saben a lunes.', 'Es el mismo café de siempre. Somos nosotros.', 'Échale otro sobre de azúcar.'],
      c: ['Otro café y lo arreglamos.', 'Habría que pedir una cafetera decente.'] },
    { a: ['¿Ya es viernes? Dime que sí.', '¿Cuánto queda para el viernes?'],
      b: ['Ojalá. Es lo que hay.', 'Demasiado. No hagas la cuenta.', 'Un día menos que ayer.'],
      c: ['Pues aguanta, que queda poco.', 'Así es la vida en la oficina.'] },
    { a: ['¿Has visto el correo del jefe?', '¿Te has enterado de lo de la reunión de las cinco?'],
      b: ['Lo he abierto y lo he cerrado. Sin leer.', '¿Qué reunión? No me asustes.', 'Lo he leído dos veces y sigo igual.'],
      c: ['Pues eso, que podría ser un correo.', 'Mejor no preguntes.'] },
    { a: ['¿Cómo llevas lo tuyo, {B}?', '¿Mucho lío hoy, {B}?'],
      b: ['Ahí va. Despacito.', 'Tres fuegos abiertos y un café. Bien.', 'Mejor que ayer, peor que mañana.'],
      c: ['Pues ánimo, que se saca.', 'Si necesitas algo, me dices.'] },
  ],
  terraza: [
    { a: ['Aquí fuera se piensa mejor.', 'Cinco minutos de aire y vuelvo a ser persona.'],
      b: ['Y no se oye el teclado de nadie.', 'Ojalá trabajar aquí todo el día.'],
      c: ['Hasta que llueva.', 'Propongo mover la oficina aquí.'] },
    { a: ['¿Has visto qué vistas, {B}?', 'Desde aquí se ve hasta la sierra.'],
      b: ['Por eso subo, no por el aire.', 'Pues yo solo veo la grúa de enfrente.'],
      c: ['Algún día haremos aquí las reuniones.', 'Una foto y para dentro.'] },
  ],
  descanso: [
    { a: ['¿Qué ponen en la tele?', '¿Qué estáis viendo?'],
      b: ['Un documental de pingüinos. Muy de oficina.', 'Nada. Está puesto de fondo.'],
      c: ['Cinco minutos más y vuelvo.', 'Esto es productividad, ¿eh?'] },
    { a: ['Este puf me conoce mejor que mi colchón.', 'Me quedo dormido aquí.'],
      b: ['No te duermas, que te conozco.', 'Si roncas, te hago una foto.'],
      c: ['Cinco minutos más y vuelvo.', 'Esto es productividad, ¿eh?'] },
  ],
  reunion: [
    { a: ['¿Cuál era el objetivo de esta reunión?', '¿Alguien sabe para qué estamos aquí?'],
      b: ['Alinearnos. Creo.', 'Revisar lo de la semana pasada. Otra vez.', 'Ni idea, pero había galletas.'],
      c: ['Lo dejamos en un correo, ¿vale?', 'Pues hacemos un seguimiento la semana que viene.'] },
    { a: ['Vale, ¿quién comparte pantalla?', '¿Comparte alguien pantalla o lo hacemos de memoria?'],
      b: ['Yo no, que tengo 40 pestañas abiertas.', 'Comparto yo. Un segundo… ¿Se ve?', 'Que comparta {B}, que lo tiene todo.'],
      c: ['Apuntado. Siguiente punto.', 'Vale, se ve. Seguimos.'] },
    { a: ['Propongo una reunión para preparar la reunión.', '¿Y si lo vemos en otra reunión?'],
      b: ['Secundo. Con orden del día.', 'Me parece perfecto. Muy nuestro.'],
      c: ['Os mando la convocatoria.', 'Apuntado. Siguiente punto.'] },
  ],
  visita: [
    { a: ['Oye, {B}, ¿tienes un minuto?', '{B}, una cosita rápida…', 'Perdona que te moleste, {B}…'],
      b: ['Un minuto de los de verdad, ¿no?', 'Dime, que estoy a mil.', 'Si es para el Excel, no estoy.'],
      c: ['Nada, que ya está. Gracias.', 'Te lo mando por correo mejor.', 'Era una tontería, ya me voy.'] },
    { a: ['{B}, ¿me miras esto cuando puedas?', '{B}, ¿esto te suena?'],
      b: ['A ver… ¿Esto quién lo ha hecho?', 'Eso es de la versión vieja.', 'Déjamelo y luego lo miro.'],
      c: ['Vale, gracias, te debo un café.', 'Pues ya me dices.'] },
  ],
  pingpong: [
    { a: ['¡Punto mío!', '¡Toma ya!'],
      b: ['Ha tocado red, repite.', 'Eso no ha botado.', 'Suerte de principiante.'],
      c: ['Al mejor de cinco.', 'Esto lo decide el VAR.'] },
    { a: ['Ese saque ha sido ilegal.', '¡Eso ha sido red!'],
      b: ['Ni de broma. Limpio.', 'Lo que tú digas. Punto mío.'],
      c: ['Esto lo decide el VAR.', 'Lo anoto en la pizarra.'] },
    { a: ['¡Va, la última!', '¿Revancha?'],
      b: ['La última de verdad.', 'Venga, pero luego a currar.'],
      c: ['Al mejor de cinco.', 'Lo anoto en la pizarra.'] },
  ],
  consola: [
    { a: ['¡No me tires el plátano!', '¡Me has echado de la pista!'],
      b: ['Es una carrera, no una ONG.', 'Ha sido sin querer. Bueno, no.'],
      c: ['Una más y volvemos.', 'Te la guardo.'] },
    { a: ['Dame el mando bueno.', 'Este mando va fatal.'],
      b: ['El mando está roto, por eso pierdes.', 'El bueno es para el que gana.'],
      c: ['Una más y volvemos.', 'Que no se entere el jefe.'] },
  ],
  evento: [
    { a: ['¿Esto cuenta como horas de trabajo?', '¿Esto computa como jornada?'],
      b: ['Si hay picoteo, sí.', 'Yo lo pongo en el parte como formación.'],
      c: ['Que se repita.', 'Pues la próxima, con música.'] },
    { a: ['Buen ambiente, ¿eh?', 'Esto hay que hacerlo más.'],
      b: ['El mejor rato de la semana.', 'Mucho mejor que una reunión.'],
      c: ['Que se repita.', 'Pues la próxima, con música.'] },
  ],
};

// Por tema del contexto (van antes que el guion del sitio si tocan). Mismo formato: hilos.
const TOPICS = {
  incidente: [
    { a: ['¿Os habéis enterado? {inc}.', 'Te cuento: {inc}. De película.', '¿Has visto? {inc}. Increíble.'],
      b: ['No hablo de eso hasta que lo arreglen.', 'Yo no he sido, que conste.', 'Ya tardaba en pasar algo.', 'Esto en otra empresa no pasa.'],
      c: ['Pues habrá que llamar a alguien.', 'Le hacemos una foto para el grupo.', 'Con esto ya tenemos tema para toda la semana.'] },
  ],
  evento: [
    { a: ['¿Vas a lo de {ev}?', 'Oye, lo de {ev}, ¿te apuntas?'],
      b: ['Si hay comida, voy.', 'Depende de cómo vaya la tarde.', 'Me lo ha dicho todo el mundo. Voy.'],
      c: ['Pues nos vemos allí.', 'Guárdame sitio.'] },
  ],
  // Cotilleo de una trama en marcha (tramas.js): {trama} = «lo de Ana y Bea con los pósits».
  trama: [
    { a: ['¿Te has enterado de {trama}?', '¿Tú sabes algo de {trama}?', 'Oye, lo de {trama}… ¿cómo va?'],
      b: ['Algo me han contado, sí. Qué fuerte.', 'No me cuentes más, que luego me lían.', 'Me he enterado por el grupo. Lo sabe todo el mundo.', 'Ni idea. Cuéntamelo todo.'],
      c: ['Esto da para una serie.', 'Mañana más, seguro.', 'Yo, de este tema, ni pío.'] },
  ],
  lluvia: [
    { a: ['Vaya día de perros.', '¿Has visto cómo llueve?'],
      b: ['Yo he venido nadando.', 'Mi paraguas no ha sobrevivido.', 'Hoy no salgo ni a por café.'],
      c: ['Y luego dicen que en España siempre hace sol.', 'Mañana teletrabajo. Avisado quedas.'] },
  ],
  nieve: [
    { a: ['¡Está nevando!', '¿Habéis visto la nieve?'],
      b: ['Si cuaja, me voy a casa a hacer un muñeco.', 'Ya verás el tráfico a la vuelta.'],
      c: ['Hoy nadie trabaja, solo mira por la ventana.'] },
  ],
  calor: [
    { a: ['Qué calor hace, por favor.', 'Aquí dentro se puede freír un huevo.'],
      b: ['El aire está puesto de adorno.', 'Yo ya he pedido un ventilador al jefe.'],
      c: ['Propongo jornada en la piscina.'] },
  ],
  frio: [
    { a: ['Qué frío hace hoy.', 'Llevo tres capas y sigo helado.'],
      b: ['Ponte junto a los servidores, que calientan.', 'El café hoy es por supervivencia.'],
      c: ['Mañana me traigo la manta.'] },
  ],
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
  // Se cotillea de las tramas de OTROS (nadie pregunta «¿te has enterado de lo mío?»).
  const gossip = (ctx.plots || []).filter(g => !members.some(m => (g.ids || []).includes(m.id)));
  if (gossip.length) topics.push(['trama', 0.3, { trama: pick(r, gossip).text }]);
  const wt = weatherTopic(ctx.weather);
  if (wt && context !== 'pingpong' && context !== 'consola') topics.push([wt, 0.25, {}]);
  let topic = null;
  let vars = {};
  for (const [t, p, v] of topics) if (r() < p) { topic = t; vars = v; break; }
  const script = pick(r, topic ? TOPICS[topic] : SCRIPTS[context] || SCRIPTS.cafe);

  const food = (A && A.eat) || (B && B.eat) || eating[0] && eating[0].eat;
  const fill = (text, speaker, listener) => text
    .replace(/\{B\}/g, listener ? listener.name : 'tú')
    .replace(/\{food\}/g, food ? FOOD_NAME[food.food] || food.food : 'eso')
    .replace(/\{inc\}/g, vars.inc || 'lo de hoy')
    .replace(/\{ev\}/g, vars.ev || 'lo de hoy')
    .replace(/\{trama\}/g, vars.trama || 'lo de hoy')
    .replace(/\{trama\}/g, vars.trama || 'lo de hoy')
    .replace(/^./, ch => ch.toUpperCase());
  // La pregunta y la respuesta salen SIEMPRE del hilo (si no, no casan). La muletilla de la ficha
  // solo como coletilla del remate, que es lo que uno suelta sin pensar al cerrar.
  const say = (speaker, list, listener, mule = 0) => {
    const own = speaker.muletillas || [];
    const text = own.length && r() < mule ? pick(r, own) : fill(pick(r, list), speaker, listener);
    // Quien habla con la boca llena, se nota.
    return speaker.eat && speaker.eat.style === 'habla' ? `(ñam) ${text}` : text;
  };

  const n = 2 + Math.floor(r() * 3); // 2-4 frases
  const C = speakers[2] || A;
  const lines = [{ id: A.id, text: say(A, script.a, B) }, { id: B.id, text: say(B, script.b, A) }];
  if (n >= 3) lines.push({ id: C.id, text: say(C, script.c || CLOSERS, B, n === 3 ? 0.3 : 0) });
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
