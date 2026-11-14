/**
 * Personajes pixel art 32x32, estilo chibi: cabeza grande, sombreado de 2-3 tonos y contorno
 * oscuro automático (lo que despega la figura del fondo). Se generan por código, sin assets,
 * y se cachean por configuración + pose.
 *
 * config: { skinTone, hairStyle, hairColor, clothes, accessory } (índices, como antes).
 */

export const SIZE = 32;

export const SKIN_TONES = ['#FFD9B8', '#E9AE85', '#C68642', '#8D5524'];
export const HAIR_STYLES = ['Corto', 'Largo', 'Rizado', 'De punta', 'Rapado', 'Media melena', 'Coleta', 'Cresta'];
export const HAIR_COLORS = ['#2C1E1A', '#6B3A2A', '#B8860B', '#F2CF4E', '#A3271F', '#8E8E99'];
export const CLOTHES = ['Camiseta', 'Camisa', 'Sudadera', 'Traje', 'Vestido', 'Polo'];
export const ACCESSORIES = ['Ninguno', 'Gafas', 'Gorra', 'Auriculares'];

const CLOTHES_COLORS = ['#4A90D9', '#EEF0F5', '#7B6CF0', '#2C3E50', '#E74C3C', '#2EAD62'];
const OUTLINE = '#1B1325';
const EYE = '#231A2E';
const SHOE = '#2B2230';
const JEANS = '#3B5B8C';

// --- color ---

function shift(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = v => Math.max(0, Math.min(255, v + amt));
  const r = c(n >> 16);
  const g = c((n >> 8) & 0xff);
  const b = c(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
const tones = base => ({ base, dark: shift(base, -38), light: shift(base, 28) });

// --- lienzo de píxeles ---

function grid() {
  const g = Array.from({ length: SIZE }, () => new Array(SIZE).fill(null));
  const p = (x, y, c) => { if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) g[y][x] = c; };
  const r = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p(x + i, y + j, c); };
  const clear = (x, y) => { if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) g[y][x] = null; };
  return { g, p, r, clear };
}

// Contorno: todo hueco vacío que toque la figura pasa a ser borde oscuro.
function outline(g) {
  const out = g.map(row => row.slice());
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (g[y][x]) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx]);
      if (n) out[y][x] = OUTLINE;
    }
  }
  return out;
}

// --- partes ---

function head(d, skin) {
  const { r, p, clear } = d;
  r(8, 5, 16, 12, skin.base);
  r(9, 4, 14, 1, skin.base);
  r(9, 17, 14, 1, skin.base);
  // sombra lateral y barbilla
  r(22, 6, 1, 11, skin.dark);
  r(10, 17, 12, 1, skin.dark);
  clear(8, 16); clear(23, 16); clear(8, 5); clear(23, 5);
  // orejas
  r(7, 10, 1, 3, skin.base);
  r(24, 10, 1, 3, skin.dark);
  // ojos con brillo
  r(11, 10, 2, 3, EYE); p(11, 10, '#FFFFFF');
  r(19, 10, 2, 3, EYE); p(19, 10, '#FFFFFF');
  // mofletes y boca
  p(10, 14, '#E98B7E'); p(21, 14, '#E98B7E');
  r(15, 14, 2, 1, '#8A3F3F');
  // cuello
  r(14, 18, 4, 1, skin.dark);
}

function legs(d, pose, pants, isDress, skin) {
  const { r } = d;
  const upL = pose === 'walk1' ? 1 : 0;
  const upR = pose === 'walk2' ? 1 : 0;
  const leg = isDress ? skin : pants;
  r(11, 26 - upL, 4, 3, leg.base); r(14, 26 - upL, 1, 3, leg.dark);
  r(17, 26 - upR, 4, 3, leg.base); r(20, 26 - upR, 1, 3, leg.dark);
  r(11, 29 - upL, 4, 1, SHOE);
  r(17, 29 - upR, 4, 1, SHOE);
}

function body(d, idx, skin, pose) {
  const { r, p } = d;
  const c = tones(CLOTHES_COLORS[idx % CLOTHES_COLORS.length]);
  // brazos: se balancean al andar
  const swing = pose === 'walk1' ? 1 : pose === 'walk2' ? -1 : 0;
  r(8, 19, 2, 5, c.base); r(8, 24 + Math.max(0, swing), 2, 1, skin.base);
  r(22, 19, 2, 5, c.dark); r(22, 24 + Math.max(0, -swing), 2, 1, skin.dark);
  // torso
  r(10, 19, 12, 7, c.base);
  r(21, 19, 1, 7, c.dark);
  r(10, 19, 1, 6, c.light);

  if (idx === 0) { // camiseta: cuello y dibujito
    r(14, 19, 4, 1, skin.base);
    r(17, 21, 2, 2, '#FFFFFF');
  } else if (idx === 1) { // camisa: cuello y botones
    p(13, 19, '#C9CCD8'); p(18, 19, '#C9CCD8'); r(14, 19, 4, 1, skin.base);
    r(15, 20, 1, 6, '#D7DAE4'); p(15, 21, '#9FA3B5'); p(15, 23, '#9FA3B5');
  } else if (idx === 2) { // sudadera: capucha, cordones y bolsillo
    r(11, 18, 10, 1, c.dark);
    p(14, 20, '#FFFFFF'); p(17, 20, '#FFFFFF'); p(14, 21, '#FFFFFF'); p(17, 21, '#FFFFFF');
    r(13, 23, 6, 2, c.dark);
  } else if (idx === 3) { // traje: camisa blanca y corbata
    r(14, 19, 4, 4, '#FFFFFF');
    r(15, 19, 2, 1, '#C0392B'); r(15, 20, 2, 4, '#E74C3C');
    p(13, 19, c.light); p(18, 19, c.light);
  } else if (idx === 4) { // vestido: falda con vuelo
    r(14, 19, 4, 1, skin.base);
    r(9, 24, 14, 3, c.base); r(21, 24, 2, 3, c.dark); r(9, 26, 14, 1, c.dark);
    p(12, 21, c.light); p(19, 21, c.light);
  } else if (idx === 5) { // polo: cuello blanco
    r(13, 19, 2, 1, '#FFFFFF'); r(17, 19, 2, 1, '#FFFFFF'); r(15, 19, 2, 2, c.dark);
    p(15, 21, '#FFFFFF');
  }
  const pants = idx === 3 ? c : tones(JEANS);
  legs(d, pose, pants, idx === 4, skin);
}

function hair(d, style, color) {
  const { r, p } = d;
  const h = tones(color);
  const shine = () => { r(10, 3, 3, 1, h.light); p(9, 4, h.light); };
  switch (style % HAIR_STYLES.length) {
    case 0: // corto
      r(9, 2, 14, 1, h.base); r(8, 3, 16, 3, h.base);
      r(8, 6, 2, 3, h.base); r(22, 6, 2, 3, h.dark);
      r(10, 6, 5, 1, h.base); p(15, 6, h.dark);
      r(8, 5, 16, 1, h.dark); r(10, 5, 5, 1, h.base);
      shine();
      break;
    case 1: // largo
      r(9, 2, 14, 1, h.base); r(8, 3, 16, 3, h.base);
      r(6, 5, 3, 14, h.base); r(23, 5, 3, 14, h.dark);
      r(9, 6, 6, 1, h.base); r(17, 6, 6, 1, h.base);
      r(6, 18, 3, 1, h.dark);
      shine();
      break;
    case 2: // rizado
      r(7, 2, 18, 4, h.base);
      for (let x = 7; x < 25; x += 2) { p(x, 1, h.base); p(x + 1, 6, h.base); }
      r(6, 4, 2, 7, h.base); r(24, 4, 2, 7, h.dark);
      for (let x = 8; x < 24; x += 3) p(x, 3, h.light);
      p(8, 5, h.dark); p(13, 4, h.dark); p(19, 5, h.dark);
      break;
    case 3: // de punta
      r(8, 3, 16, 3, h.base); r(8, 6, 2, 2, h.base); r(22, 6, 2, 2, h.dark);
      for (let x = 8; x < 24; x += 3) { r(x, 1, 2, 2, h.base); p(x + 1, 0, h.base); }
      r(8, 5, 16, 1, h.dark);
      shine();
      break;
    case 4: // rapado
      r(9, 3, 14, 1, h.dark); r(8, 4, 16, 2, h.dark);
      for (let x = 9; x < 23; x += 2) p(x, 4, h.base);
      break;
    case 5: // media melena
      r(9, 2, 14, 1, h.base); r(8, 3, 16, 4, h.base);
      r(6, 5, 3, 10, h.base); r(23, 5, 3, 10, h.dark);
      r(9, 7, 4, 1, h.base); r(19, 7, 4, 1, h.base);
      r(6, 14, 3, 1, h.dark);
      shine();
      break;
    case 6: // coleta
      r(9, 2, 14, 1, h.base); r(8, 3, 16, 3, h.base);
      r(8, 6, 2, 2, h.base); r(22, 6, 2, 2, h.dark);
      r(24, 4, 3, 2, h.base); r(25, 6, 2, 7, h.base); p(26, 12, h.dark); r(24, 4, 1, 2, '#E74C3C');
      r(8, 5, 16, 1, h.dark); r(10, 5, 4, 1, h.base);
      shine();
      break;
    case 7: // cresta
      r(13, 0, 6, 6, h.base); r(17, 0, 2, 6, h.dark); p(14, 0, h.light); p(14, 1, h.light);
      r(8, 5, 5, 1, shift(color, -60)); r(19, 5, 5, 1, shift(color, -60));
      break;
    default:
      break;
  }
}

function accessory(d, idx) {
  const { r, p } = d;
  if (idx === 1) { // gafas: cristal claro y montura fina, que se vean los ojos
    const frame = '#3A3A4A';
    for (const [x0, eye] of [[9, 11], [17, 19]]) {
      r(x0 + 1, 10, 4, 3, '#D6ECFF');
      r(eye, 10, 2, 3, EYE); p(eye, 10, '#FFFFFF');
      r(x0, 9, 6, 1, frame); r(x0, 13, 6, 1, frame);
      r(x0, 9, 1, 5, frame); r(x0 + 5, 9, 1, 5, frame);
    }
  } else if (idx === 2) { // gorra
    const cap = tones('#E17055');
    r(8, 1, 16, 5, cap.base); r(9, 0, 14, 1, cap.base); r(21, 1, 3, 5, cap.dark);
    r(7, 6, 18, 1, cap.dark);
    r(15, 2, 2, 2, '#FFFFFF');
  } else if (idx === 3) { // auriculares
    const band = '#34343F';
    r(9, 0, 14, 1, band); p(8, 1, band); p(23, 1, band); r(7, 2, 1, 6, band); r(24, 2, 1, 6, band);
    r(5, 8, 3, 6, band); r(24, 8, 3, 6, band);
    r(6, 9, 1, 4, '#FD79A8'); r(25, 9, 1, 4, '#FD79A8');
  }
}

// --- generación y caché ---

const CACHE = new Map();
const key = (c, pose) => `${c.skinTone | 0}-${c.hairStyle | 0}-${c.hairColor | 0}-${c.clothes | 0}-${c.accessory | 0}-${pose}`;

export function characterSprite(config = {}, pose = 'idle') {
  const k = key(config, pose);
  if (CACHE.has(k)) return CACHE.get(k);
  const d = grid();
  const skin = tones(SKIN_TONES[(config.skinTone | 0) % SKIN_TONES.length]);
  body(d, config.clothes | 0, skin, pose);
  head(d, skin);
  hair(d, config.hairStyle | 0, HAIR_COLORS[(config.hairColor | 0) % HAIR_COLORS.length]);
  accessory(d, config.accessory | 0);
  const g = outline(d.g);

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!g[y][x]) continue;
      ctx.fillStyle = g[y][x];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  CACHE.set(k, canvas);
  return canvas;
}

// Dibuja el personaje con su sombra en el suelo.
export function drawCharacter(ctx, config, x, y, scale = 1, pose = 'idle') {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x + (SIZE * scale) / 2, y + 30 * scale, 8 * scale, 2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(characterSprite(config, pose), Math.round(x), Math.round(y), SIZE * scale, SIZE * scale);
}
