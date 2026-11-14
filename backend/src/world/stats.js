const { SCHEDULE, BLOCKS } = require('./clock');

// Estados del personaje, de 0 a 5 con un decimal: energía, ánimo, saciedad, social y calma.
// Los mueven REGLAS según lo que hace (no la IA): comer llena, reunirse cansa y estresa, la
// terraza alegra (si no llueve)… La IA solo influye a través del humor que declara.

const KEYS = ['energia', 'animo', 'saciedad', 'social', 'calma'];
const DEFAULT = { energia: 4, animo: 3.5, saciedad: 3.5, social: 3, calma: 3.5 };

const clamp = v => Math.round(Math.min(5, Math.max(0, v)) * 10) / 10;

function normalize(stats) {
  const s = { ...DEFAULT, ...(stats || {}) };
  const out = {};
  for (const k of KEYS) out[k] = clamp(Number(s[k]) || 0);
  return out;
}

// Efecto de cada sitio al empezar una acción allí.
const PLACE_EFFECT = {
  mesa: { energia: -0.3, saciedad: -0.2, social: -0.1, calma: -0.2 },
  cafe: { energia: 0.3, saciedad: 0.4, social: 0.4, calma: 0.2 },
  reuniones: { energia: -0.3, social: 0.3, calma: -0.4 },
  descanso: { energia: 0.6, calma: 0.5 },
  terraza: { animo: 0.4, calma: 0.4, social: 0.2 },
  recepcion: { social: 0.2, calma: -0.2 },
  despacho: { social: 0.1, calma: -0.5 },
  servidores: { energia: -0.2, calma: -0.2 },
  lavabo: { calma: 0.2 },
  casa: { energia: -0.1, social: -0.2, calma: 0.2, saciedad: -0.1 },
};

function add(s, delta) {
  const out = { ...s };
  for (const [k, v] of Object.entries(delta)) out[k] = clamp(out[k] + v);
  return out;
}

// action: { lugar, con, externo, min }; ctx: { weather: { code, temp } | null }
function applyAction(stats, action, ctx = {}) {
  let s = add(normalize(stats), PLACE_EFFECT[action.lugar] || PLACE_EFFECT.mesa);
  // La comida de verdad: café/cocina a la hora de comer (con media hora de margen antes).
  if (action.lugar === 'cafe' && action.min >= SCHEDULE.lunch - 30 && action.min <= SCHEDULE.lunch + SCHEDULE.lunchMin) s = add(s, { saciedad: 1.2, animo: 0.2 });
  if (action.con) s = add(s, { social: 0.3 });
  if (action.externo) s = add(s, { calma: -0.3, energia: -0.1 });
  if (action.min >= BLOCKS.tarde.to) s = add(s, { energia: -0.5, calma: -0.3, animo: -0.2 }); // horas extra
  const w = ctx.weather;
  if (action.lugar === 'terraza' && w) {
    const wet = w.code >= 51; // llovizna, lluvia, nieve, tormenta
    if (wet || w.temp < 8) s = add(s, { animo: -0.6, calma: -0.3 });
    else if (w.temp > 32) s = add(s, { energia: -0.4 });
  }
  return s;
}

const HUMOR_TARGET = { euforico: 5, contento: 4, normal: 3, mosqueado: 2, agobiado: 1.8, triste: 1.5, dormido: 2.5 };

// El humor que declara la IA tira del ánimo hacia su valor (sin saltos bruscos).
function applyHumor(stats, humor) {
  const s = normalize(stats);
  const target = HUMOR_TARGET[humor];
  if (target == null) return s;
  let out = { ...s, animo: clamp(s.animo + (target - s.animo) * 0.6) };
  if (humor === 'agobiado') out = add(out, { calma: -0.8 });
  if (humor === 'dormido') out = add(out, { energia: -0.8 });
  return out;
}

// Por la mañana: ha dormido (energía y calma se recuperan) y ha desayunado.
function morning(stats) {
  const s = normalize(stats);
  return {
    energia: clamp(Math.max(s.energia, 3.6) + 0.4),
    animo: clamp(s.animo + (3.2 - s.animo) * 0.4),
    saciedad: 3.6,
    social: clamp(s.social + (3 - s.social) * 0.5),
    calma: clamp(s.calma + (3.6 - s.calma) * 0.6),
  };
}

module.exports = { KEYS, DEFAULT, normalize, applyAction, applyHumor, morning, PLACE_EFFECT };
