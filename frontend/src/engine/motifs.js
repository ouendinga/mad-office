// Motivos en pixel art (8×8) para las escenas de la transformación: salen de lo que la persona
// ha contado en la entrevista («montaña» → una montaña). Sin IA: palabras clave.

const M = (grid, pal) => ({ grid, pal });

export const MOTIFS = {
  montana: M(['...W....', '..WWS...', '..SSSS.W', '.SSSSSWS', '.SSSSSSS', 'SSSSSSSS', 'GGGGGGGG', 'GGGGGGGG'],
    { W: '#ffffff', S: '#8d99ae', G: '#2ecc71' }),
  cafe: M(['..B.B...', '.B.B....', 'WWWWWW..', 'WCCCCWWW', 'WCCCCW.W', 'WCCCCWWW', '.WWWW...', '........'],
    { B: '#c8c8d0', W: '#ffffff', C: '#6f4e37' }),
  te: M(['........', '...G....', 'WWWWWW..', 'WTTTTWWW', 'WTTTTW.W', 'WTTTTWWW', '.WWWW...', '........'],
    { G: '#2ecc71', W: '#ffffff', T: '#c0873f' }),
  codigo: M(['.DDDDDD.', '.DLLLLD.', '.DLGGLD.', '.DLLGLD.', '.DLLLLD.', '.DDDDDD.', 'DDDDDDDD', '........'],
    { D: '#3d3d5c', L: '#1e3a8a', G: '#4ade80' }),
  excel: M(['GGGGGGGG', 'GWWGWWGW', 'GGGGGGGG', 'GWWGWWGW', 'GGGGGGGG', 'GWWGWWGW', 'GGGGGGGG', '........'],
    { G: '#1d6f42', W: '#e8f5e9' }),
  musica: M(['....NNNN', '....N..N', '....N..N', '....N..N', '..NNN.NN', '.NNNNNNN', '.NNN.NN.', '........'],
    { N: '#f1c40f' }),
  futbol: M(['..WWWW..', '.WKWWKW.', 'WWWKKWWW', 'WKWKKWKW', 'WWWWWWWW', 'WKWWWWKW', '.WWKKWW.', '..WWWW..'],
    { W: '#ffffff', K: '#222222' }),
  libro: M(['BBBBBBB.', 'BWWWWWB.', 'BWKKKWB.', 'BWWWWWB.', 'BWKKKWB.', 'BWWWWWB.', 'BBBBBBB.', '........'],
    { B: '#c0392b', W: '#fdf6e3', K: '#555555' }),
  juego: M(['........', '.DDDDDD.', 'DDWDDRDD', 'DWWWDRDR', 'DDWDDRDD', 'DDDDDDDD', 'DD....DD', '........'],
    { D: '#4b4b6b', W: '#ffffff', R: '#e74c3c' }),
  planta: M(['..G..G..', '.GGGGGG.', '..GGGG..', '...GG...', '..TTTT..', '..TTTT..', '...TT...', '........'],
    { G: '#27ae60', T: '#b5651d' }),
  gato: M(['K.....K.', 'KK...KK.', 'KKKKKKK.', 'KYKKKYK.', 'KKKPKKK.', '.KKKKK..', '........', '........'],
    { K: '#444455', Y: '#f1c40f', P: '#ff9ff3' }),
  perro: M(['BB...BB.', 'BBBBBBB.', 'BWBBBWB.', 'BBBKBBB.', '.BBBBB..', '..BPB...', '........', '........'],
    { B: '#a0522d', W: '#ffffff', K: '#222222', P: '#ff6b81' }),
  playa: M(['....YY..', '...YYYY.', '....YY..', '........', 'B.B.B.B.', 'BBBBBBBB', 'SSSSSSSS', 'SSSSSSSS'],
    { Y: '#f9ca24', B: '#3498db', S: '#f6e58d' }),
  bici: M(['........', '....KR..', '...R.R..', '.KKRRRK.', 'K..K.K.K', 'K..K.K.K', '.KK...K.', '........'],
    { K: '#dddddd', R: '#e74c3c' }),
  cocina: M(['.WWWWW..', 'WWWWWWW.', '.WWWWW..', '..W.W...', 'KKKKKKK.', '.KKKKK..', '........', '........'],
    { W: '#ffffff', K: '#555566' }),
  postit: M(['YYYYYY..', 'YKKKKY..', 'YYYYYYPP', 'YKKKYPPP', 'YYYYYPKP', '.....PPP', '........', '........'],
    { Y: '#fde047', K: '#a16207', P: '#f9a8d4' }),
  corona: M(['........', 'Y..Y..Y.', 'YY.YY.YY', 'YYYYYYYY', 'YRYYBYYR', 'YYYYYYYY', '........', '........'],
    { Y: '#f1c40f', R: '#e74c3c', B: '#3498db' }),
  rayo: M(['....YY..', '...YY...', '..YY....', '.YYYYY..', '...YY...', '..YY....', '.YY.....', '........'],
    { Y: '#fde047' }),
  estrella: M(['...Y....', '...Y....', 'YYYYYYY.', '.YYYYY..', '..YYY...', '.YY.YY..', 'Y.....Y.', '........'],
    { Y: '#fde047' }),
  corazon: M(['.RR.RR..', 'RRRRRRR.', 'RRRRRRR.', '.RRRRR..', '..RRR...', '...R....', '........', '........'],
    { R: '#ff4d6d' }),
};

// Palabras (sin tildes) → motivo. El orden importa poco: se cogen los primeros que aparezcan.
const KEYWORDS = [
  ['montana', ['montan', 'monte', 'escal', 'ferrata', 'sender', 'trek', 'alpin', 'cumbre', 'pirineo']],
  ['cafe', ['cafe', 'cafetera', 'espresso']],
  ['te', [' te ', 'te,', 'infusion']],
  ['codigo', ['codigo', 'program', 'backend', 'frontend', 'php', 'java', 'python', 'developer', 'desarroll', ' ia', ' ai', 'flujos']],
  ['excel', ['excel', 'hoja de calculo', 'datos', 'finanz', 'contab']],
  ['musica', ['musica', 'guitarra', 'cantar', 'concierto', 'piano', 'bater']],
  ['futbol', ['futbol', 'balon', 'porra', 'partido']],
  ['libro', ['libro', 'leer', 'lectura', 'novela']],
  ['juego', ['videojuego', 'gamer', 'consola', 'jugar', 'play']],
  ['planta', ['planta', 'jardin', 'huerto', 'flores']],
  ['gato', ['gato', 'michi']],
  ['perro', ['perro', 'perrete']],
  ['playa', ['playa', 'surf', 'nadar', 'mar ', 'vela']],
  ['bici', ['bici', 'ciclis', 'pedal']],
  ['cocina', ['cocin', 'receta', 'chef', 'tortilla']],
  ['postit', ['postit', 'post-it', 'notas', 'agenda']],
  ['corona', ['ceo', 'jefe', 'jefa', 'director', 'manager', 'boss', 'lider']],
  ['rayo', ['superpoder', 'rapido', 'energia', 'mejorar']],
];

const fold = s => ` ${String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')} `;

// Hasta `max` motivos para estas respuestas; siempre sale alguno (estrella, corazón…).
export function motifsFor(answers, max = 5) {
  const text = fold(Object.values(answers || {}).join(' · '));
  const out = [];
  for (const [key, words] of KEYWORDS) {
    if (out.length >= max) break;
    if (words.some(w => text.includes(w))) out.push(key);
  }
  for (const k of ['estrella', 'corazon', 'rayo']) if (out.length < 3 && !out.includes(k)) out.push(k);
  return out;
}

// Pinta un motivo en (x, y) con píxeles de tamaño s.
export function drawMotif(ctx, key, x, y, s = 2, alpha = 1) {
  const m = MOTIFS[key];
  if (!m) return;
  ctx.globalAlpha = alpha;
  m.grid.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = m.pal[row[i]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x + i * s), Math.round(y + j * s), s, s);
    }
  });
  ctx.globalAlpha = 1;
}
