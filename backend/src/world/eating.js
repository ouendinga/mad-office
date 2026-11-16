// Cómo come cada uno. Lo decide el servidor (por reglas, sin IA) y va en el estado del mundo
// (`eat: { style, food }`) para que el navegador lo dibuje: el navegador no inventa nada, solo
// sabe dibujar cada estilo.
//
// El estilo es de la PERSONA (no cambia de un día a otro, como en la vida): sale de su ficha
// (palabras clave), de sus rasgos fijos (incidents.traits) y, si nada lo marca, de su id. La
// comida sí cambia cada día. Hay una excepción de contexto: quien «come mirando vídeos» lo hace
// con el móvil en la mano, sea cual sea su estilo.

const { rng } = require('./autopilot');
const { traits } = require('./incidents');

// rapido: bocados seguidos, sin respirar · bocaditos: a picotazos, despacio · taper: el táper y
// el tenedor de toda la vida · palillos: bol y palillos · mancha: se mancha la camisa ·
// movil: come mirando el móvil · habla: habla con la boca llena · bocata: bocadillo a dos manos.
const STYLES = ['rapido', 'bocaditos', 'taper', 'palillos', 'mancha', 'movil', 'habla', 'bocata'];

// Qué hay en el táper (el dibujo cambia de color) y con qué va cada estilo.
const FOODS = ['pasta', 'ensalada', 'arroz', 'lentejas', 'tortilla', 'pizza'];
const FOOD_FOR = { palillos: ['sushi', 'arroz', 'fideos'], bocata: ['bocata'], bocaditos: ['ensalada', 'fruta', 'ensalada'] };

// Por la ficha: lo primero que case manda.
const BY_FICHA = [
  [/sushi|japon|asiátic|asiatic|ramen|palillo|wok|fideos/, 'palillos'],
  [/móvil|movil|redes sociales|tiktok|instagram|scroll|netflix|series|youtube/, 'movil'],
  [/prisa|rápid|rapid|estrés|estres|agobi|deadline|urgente|no para quiet|acelerad/, 'rapido'],
  [/dieta|healthy|sano|gimnasio|\bgym\b|fitness|crossfit|ensalada|vegan|tupper de brócoli|brócoli/, 'bocaditos'],
  [/cotill|parlanch|chism|no calla|habla por los codos|charlatán|charlatan/, 'habla'],
  [/bocadillo|bocata|pan con/, 'bocata'],
];

// ¿Esta acción es comer? La comida del piloto automático lleva `comida: true`; los planes de la
// IA no la llevan, así que también vale lo que dice el texto («Come de táper», «Comida en grupo»).
// «Vuelve de comer» NO es comer.
const EATS = /\b(come|comen|comida|comiendo|almuerz\w*|táper|taper|tupper|bocata|bocadillo|picnic)\b/i;
function isEating(action) {
  if (!action) return false;
  if (action.comida) return true;
  return EATS.test(String(action.que || '')) && !/vuelve de comer|después de comer|antes de comer/i.test(String(action.que || ''));
}

// Su estilo de siempre.
function styleOf(c) {
  const text = `${JSON.stringify(c.ficha || {})} ${c.position_title || ''}`.toLowerCase();
  for (const [re, style] of BY_FICHA) if (re.test(text)) return style;
  const t = traits(c);
  if (t.torpe) return 'mancha';
  if (t.cocinaMal) return 'taper'; // el del táper que huele (y que calienta tres veces)
  const r = rng(`comer|${c.id}`);
  return STYLES[Math.floor(r() * STYLES.length)];
}

// Lo que va al navegador mientras come: { style, food }. `seed` cambia la comida (el día).
function eatingStyle(c, action = {}, seed = '') {
  let style = styleOf(c);
  if (/v[íi]deos|m[óo]vil/i.test(String(action.que || ''))) style = 'movil';
  const pool = FOOD_FOR[style] || FOODS;
  const food = pool[Math.floor(rng(`comida|${c.id}|${seed}`)() * pool.length)];
  return { style, food };
}

module.exports = { STYLES, FOODS, isEating, styleOf, eatingStyle };
