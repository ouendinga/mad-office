// Incidentes con estado: cosas que pasan en la oficina por REGLAS (sin IA), con su probabilidad,
// sus condiciones, quién las provoca, qué cambian y cómo se arreglan. Cada uno deja un estado que se
// ve en el mapa y que los demás perciben (lo comentan al llegar y entra en lo que «oyen» y en sus
// prompts). La IA no decide qué pasa: solo cómo reacciona cada uno según su carácter.
//
// Para añadir uno: una entrada en CATALOG. `needs` son tipos de objeto del mapa (si la oficina no
// tiene cafetera, no se rompe la cafetera), `chance(ctx)` es la probabilidad por hora de oficina en
// las condiciones de ese momento, y `repair` dice cómo se arregla:
//   tiempo  → se pasa solo (duration, en minutos);
//   alguien → lo arregla alguien de la oficina (al hacer la escapada `fixWith`, o un manitas al rato);
//   tecnico → viene el técnico el siguiente día laborable.

const { rng } = require('./autopilot');

const MAX_PER_DAY = 3;
const ALGUIEN_MAX_MIN = 150; // si nadie lo arregla en este tiempo, un manitas se encarga

// Rasgos fijos de cada persona (no cambian de un día a otro): deciden quién la lía y quién arregla.
function traits(c) {
  const r = rng(`rasgos|${c.id}`);
  const t = `${JSON.stringify(c.ficha || {})} ${c.position_title || ''}`.toLowerCase();
  return {
    cocinaMal: r() < 0.25 || /cocina fatal|quema|micro|pescado/.test(t),
    malaLeche: r() < 0.15 || /gruñ|borde|mala leche|mosque|cínic|sarcás/.test(t),
    torpe: r() < 0.2 || /torpe|despist|caos|desastre/.test(t),
    manitas: r() < 0.2 || /sistem|manitas|devops|soporte|ingenier|mantenim/.test(t),
  };
}

const name = c => (c ? c.name : 'alguien');

const CATALOG = [
  {
    kind: 'maquina_rota', place: 'cafe', needs: ['vending'], repair: 'tecnico', sign: 'NO FUNCIONA',
    chance: () => 0.035, cause: 'presente',
    title: c => `🥤 La máquina de snacks se traga el euro de ${name(c)} y deja de dar nada.`,
    react: ['¿Otra vez rota?', 'Le doy un golpe y sale, verás.', 'Me debe tres euros.', 'Sin snacks no hay productividad.'],
    fixed: () => '🔧 El técnico arregla la máquina de snacks. «¿Quién le ha metido un botón?»',
  },
  {
    kind: 'cafetera_rota', place: 'cafe', needs: ['kitchen_counter'], repair: 'tecnico', sign: 'SIN CAFÉ',
    chance: () => 0.02, cause: 'presente',
    title: c => `☕ La cafetera hace un ruido horrible mientras ${name(c)} se pone un café, y se apaga.`,
    react: ['¿SIN CAFÉ?', 'Esto es un atentado.', 'Hoy no se trabaja.', 'Voy al bar de abajo. Volveré.'],
    fixed: () => '🔧 El técnico resucita la cafetera. Aplausos en la cocina.',
    stats: { animo: -0.3, energia: -0.2 },
  },
  {
    kind: 'olor_micro', place: 'cafe', needs: ['kitchen_counter'], repair: 'tiempo', duration: [60, 150], avoid: true,
    // A la hora de comer, si quien cocina fatal está en la cocina, es casi seguro.
    chance: ctx => (ctx.lunch && ctx.inPlace('cafe').some(c => traits(c).cocinaMal) ? 0.9 : 0.01),
    cause: c => traits(c).cocinaMal, causePlace: 'cafe',
    title: c => `🐟 ${name(c)} calienta pescado en el micro. La cocina apesta.`,
    react: ['¡Qué peste!', '¿Quién ha calentado pescado?', 'Me como el táper fuera.', 'Abrid la ventana, por favor.'],
    fixed: () => '🌬️ Por fin ya no huele la cocina.',
    stats: { calma: -0.2 },
  },
  {
    kind: 'postits_viento', place: 'mesa', needs: ['kanban'], repair: 'alguien', fixWith: 'kanban',
    chance: ctx => (ctx.windy ? 0.25 : 0.015), cause: 'presente',
    title: c => `🌬️ ${name(c)} abre la ventana y el viento se lleva los pósits del kanban. Están por el suelo.`,
    react: ['¡Mis tareas!', 'Pues ya no hay nada pendiente.', '¿Esto era urgente o importante?', 'Yo no piso nada.'],
    fixed: c => `📌 ${name(c)} recoge los pósits y los vuelve a pegar (más o menos donde estaban).`,
  },
  {
    kind: 'postits_movidos', place: 'mesa', needs: ['kanban'], repair: 'tiempo', duration: [60, 180], victim: true,
    chance: () => 0.04, cause: c => traits(c).malaLeche,
    title: (c, v) => `📌 ${name(c)} mueve los pósits de ${name(v)} a «Bloqueado». Nadie sabe por qué.`,
    react: ['¿Quién ha tocado el kanban?', 'Esto huele a sabotaje.', 'Yo no he visto nada.'],
    fixed: (c, v) => `📌 ${name(v)} devuelve sus pósits a su sitio y mira mal a todo el mundo.`,
  },
  {
    kind: 'impresora_atasco', place: 'mesa', needs: ['printer'], repair: 'alguien', fixWith: 'impresora', sign: 'ATASCO',
    chance: () => 0.06, cause: 'presente',
    title: c => `🖨️ La impresora se atasca con el documento de ${name(c)}. Luz naranja parpadeando.`,
    react: ['Atasco de papel. Cómo no.', 'Yo no he sido.', '¿Alguien sabe abrir esto?'],
    fixed: c => `🖨️ ${name(c)} desatasca la impresora a golpes. Funciona (de momento).`,
  },
  {
    kind: 'bano_inundado', place: 'lavabo', needs: ['stall'], repair: 'tecnico', closes: true, sign: 'CERRADO',
    chance: () => 0.01, cause: 'presente',
    title: () => '🚽 Se atasca un váter y el baño se inunda. Cerrado hasta que venga el técnico.',
    react: ['¿Y ahora dónde voy?', 'Esto es una emergencia.', 'Voy al bar de abajo.'],
    fixed: () => '🔧 El técnico desatasca el baño. Vuelve a abrir (con olor a lejía).',
  },
  {
    kind: 'apagon', place: 'oficina', needs: [], repair: 'tiempo', duration: [15, 40], everywhere: true,
    chance: ctx => (ctx.storm ? 0.08 : 0.006), cause: null,
    title: () => '💡 ¡Apagón! Se va la luz en toda la oficina.',
    react: ['¿Alguien ha guardado?', 'Por fin un descanso.', 'Pues me voy a por un café… ah, no.', '¿Esto cuenta como pausa?'],
    fixed: () => '💡 Vuelve la luz. Medio open space ha perdido lo que no había guardado.',
    stats: { calma: -0.3 },
  },
  {
    kind: 'aire_roto', place: 'mesa', needs: ['ac_unit'], repair: 'tecnico',
    chance: ctx => (ctx.hot ? 0.08 : 0.004), cause: null,
    title: () => '🥵 El aire acondicionado se ha roto. Hace un calor de horno.',
    react: ['Me derrito.', '¿Abrimos la ventana?', 'Esto es un horno.'],
    fixed: () => '❄️ El técnico arregla el aire. Vuelve la paz.',
    stats: { energia: -0.3, calma: -0.2 },
  },
  {
    kind: 'sin_cafe', place: 'cafe', needs: ['kitchen_counter'], repair: 'tiempo', duration: [60, 180], sign: 'NO HAY CAFÉ',
    chance: () => 0.03, cause: 'presente',
    title: c => `🫙 ${name(c)} abre el bote del café y está vacío. Nadie lo había repuesto.`,
    react: ['¿Quién se ha acabado el café?', 'Esto es inaceptable.', 'Té, entonces. Qué remedio.'],
    fixed: c => `☕ ${name(c)} baja al súper y repone el café. Héroe del día.`,
    stats: { animo: -0.2 },
  },
];
const BY_KIND = Object.fromEntries(CATALOG.map(x => [x.kind, x]));

// ¿Puede pasar en esta oficina? (tiene los objetos que hacen falta)
function possible(def, mapTypes) {
  return def.needs.every(t => mapTypes.has(t));
}

function pickCause(def, ctx, r) {
  if (!def.cause) return null;
  const pool = def.cause === 'presente'
    ? ctx.inPlace(def.place === 'oficina' ? null : def.place)
    : ctx.inPlace(def.causePlace || null).filter(def.cause);
  if (!pool.length) return undefined; // nadie que lo provoque: no pasa
  return pool[Math.floor(r() * pool.length)];
}

// Nuevos incidentes de este minuto. ctx: { companyId, day, min, lunch, windy, storm, hot, mapTypes,
// inPlace(place|null) -> personajes en la oficina (en ese sitio, o todos), startedToday, active }.
function roll(ctx) {
  if (ctx.startedToday >= MAX_PER_DAY) return [];
  const out = [];
  for (const def of CATALOG) {
    if (!possible(def, ctx.mapTypes) || ctx.active.some(a => a.kind === def.kind)) continue;
    const r = rng(`${ctx.companyId}|${ctx.day}|${ctx.min}|${def.kind}`);
    if (r() >= def.chance(ctx) / 60) continue;
    const cause = pickCause(def, ctx, r);
    if (cause === undefined) continue;
    let victim = null;
    if (def.victim) {
      const others = ctx.inPlace(null).filter(c => !cause || c.id !== cause.id);
      if (!others.length) continue;
      victim = others[Math.floor(r() * others.length)];
    }
    const dur = def.duration ? def.duration[0] + Math.floor(r() * (def.duration[1] - def.duration[0])) : null;
    out.push({ def, cause, victim, endsMin: dur ? ctx.min + dur : null });
    if (out.length + ctx.startedToday >= MAX_PER_DAY) break;
  }
  return out;
}

// Lo que cambian los incidentes abiertos en el comportamiento de la oficina.
function effects(active) {
  const kinds = new Set(active.map(a => a.kind));
  return {
    closed: new Set(active.filter(a => (BY_KIND[a.kind] || {}).closes).map(a => a.place)),
    avoid: new Set(active.filter(a => (BY_KIND[a.kind] || {}).avoid).map(a => a.place)),
    noSnack: kinds.has('maquina_rota'),
    apagon: kinds.has('apagon'),
  };
}

function reaction(kind, r) {
  const def = BY_KIND[kind];
  return def ? def.react[Math.floor(r() * def.react.length)] : null;
}

module.exports = { CATALOG, BY_KIND, MAX_PER_DAY, ALGUIEN_MAX_MIN, traits, possible, roll, effects, reaction };
