/**
 * Pixel Art Avatar Sprite System
 * 16x16 base sprites, rendered at scale (default 4x = 64x64)
 * Layered system: body -> clothes -> hair -> accessories
 */

export const SKIN_TONES = [
  '#FFDBB4', // Light
  '#E8A87C', // Medium light
  '#C68642', // Medium
  '#8D5524', // Dark
];

export const HAIR_STYLES = [
  'Short', 'Long', 'Curly', 'Spiky', 'Buzz', 'Bob', 'Ponytail', 'Mohawk'
];

export const HAIR_COLORS = [
  '#2C1810', // Black
  '#6B3A2A', // Brown
  '#B8860B', // Dark blonde
  '#FFD700', // Blonde
  '#8B0000', // Red
  '#4A4A4A', // Gray
];

export const CLOTHES = [
  'Camiseta', 'Camisa', 'Hoodie', 'Traje', 'Vestido', 'Polo'
];

export const ACCESSORIES = [
  'Ninguno', 'Gafas', 'Gorra', 'Auriculares'
];

const CLOTHES_COLORS = [
  '#4A90D9', // Blue tshirt
  '#FFFFFF', // White shirt
  '#6C5CE7', // Purple hoodie
  '#2C3E50', // Dark suit
  '#E74C3C', // Red dress
  '#27AE60', // Green polo
];

// --- Pixel art drawing helpers ---

function setPixel(ctx, x, y, color, scale) {
  ctx.fillStyle = color;
  ctx.fillRect(x * scale, y * scale, scale, scale);
}

// Body base sprite (16x16) - sitting pose
function drawBody(ctx, skinTone, ox, oy, scale) {
  const skin = SKIN_TONES[skinTone] || SKIN_TONES[0];
  const skinDark = darkenColor(skin, 30);

  // Head (6x6, centered at row 1-6, col 5-10)
  for (let y = 1; y <= 6; y++) {
    for (let x = 5; x <= 10; x++) {
      setPixel(ctx, ox + x, oy + y, skin, scale);
    }
  }
  // Head shadow
  for (let x = 5; x <= 10; x++) {
    setPixel(ctx, ox + x, oy + 6, skinDark, scale);
  }

  // Eyes
  setPixel(ctx, ox + 6, oy + 3, '#1A1A2E', scale);
  setPixel(ctx, ox + 9, oy + 3, '#1A1A2E', scale);

  // Mouth (small smile)
  setPixel(ctx, ox + 7, oy + 5, '#C0392B', scale);
  setPixel(ctx, ox + 8, oy + 5, '#C0392B', scale);

  // Neck
  setPixel(ctx, ox + 7, oy + 7, skin, scale);
  setPixel(ctx, ox + 8, oy + 7, skin, scale);

  // Body/torso (sitting)
  for (let y = 8; y <= 12; y++) {
    for (let x = 4; x <= 11; x++) {
      setPixel(ctx, ox + x, oy + y, skin, scale);
    }
  }

  // Arms
  for (let y = 8; y <= 11; y++) {
    setPixel(ctx, ox + 3, oy + y, skin, scale);
    setPixel(ctx, ox + 12, oy + y, skin, scale);
  }
  // Hands
  setPixel(ctx, ox + 3, oy + 12, skin, scale);
  setPixel(ctx, ox + 12, oy + 12, skin, scale);

  // Legs (sitting, shorter)
  for (let y = 13; y <= 14; y++) {
    for (let x = 5; x <= 7; x++) {
      setPixel(ctx, ox + x, oy + y, skinDark, scale);
    }
    for (let x = 8; x <= 10; x++) {
      setPixel(ctx, ox + x, oy + y, skinDark, scale);
    }
  }

  // Feet
  setPixel(ctx, ox + 4, oy + 15, '#4A4A4A', scale);
  setPixel(ctx, ox + 5, oy + 15, '#4A4A4A', scale);
  setPixel(ctx, ox + 6, oy + 15, '#4A4A4A', scale);
  setPixel(ctx, ox + 9, oy + 15, '#4A4A4A', scale);
  setPixel(ctx, ox + 10, oy + 15, '#4A4A4A', scale);
  setPixel(ctx, ox + 11, oy + 15, '#4A4A4A', scale);
}

function drawClothes(ctx, clothesIndex, ox, oy, scale) {
  const color = CLOTHES_COLORS[clothesIndex] || CLOTHES_COLORS[0];
  const colorDark = darkenColor(color, 30);

  // Base torso clothing
  for (let y = 8; y <= 12; y++) {
    for (let x = 4; x <= 11; x++) {
      setPixel(ctx, ox + x, oy + y, color, scale);
    }
  }

  // Sleeves
  for (let y = 8; y <= 10; y++) {
    setPixel(ctx, ox + 3, oy + y, color, scale);
    setPixel(ctx, ox + 12, oy + y, color, scale);
  }

  // Style variations
  switch (clothesIndex) {
    case 0: // Camiseta - simple
      break;
    case 1: // Camisa - collar + buttons
      setPixel(ctx, ox + 6, oy + 7, '#EEEEEE', scale);
      setPixel(ctx, ox + 9, oy + 7, '#EEEEEE', scale);
      for (let y = 9; y <= 12; y++) {
        setPixel(ctx, ox + 7, oy + y, colorDark, scale);
      }
      break;
    case 2: // Hoodie - hood outline
      setPixel(ctx, ox + 5, oy + 7, color, scale);
      setPixel(ctx, ox + 10, oy + 7, color, scale);
      setPixel(ctx, ox + 7, oy + 11, colorDark, scale);
      setPixel(ctx, ox + 8, oy + 11, colorDark, scale);
      break;
    case 3: // Traje - lapels
      setPixel(ctx, ox + 5, oy + 8, colorDark, scale);
      setPixel(ctx, ox + 10, oy + 8, colorDark, scale);
      setPixel(ctx, ox + 5, oy + 9, colorDark, scale);
      setPixel(ctx, ox + 10, oy + 9, colorDark, scale);
      // Tie
      for (let y = 8; y <= 11; y++) {
        setPixel(ctx, ox + 7, oy + y, '#E74C3C', scale);
      }
      break;
    case 4: // Vestido - longer
      for (let x = 5; x <= 10; x++) {
        setPixel(ctx, ox + x, oy + 13, color, scale);
      }
      break;
    case 5: // Polo - collar
      setPixel(ctx, ox + 6, oy + 7, colorDark, scale);
      setPixel(ctx, ox + 9, oy + 7, colorDark, scale);
      setPixel(ctx, ox + 7, oy + 8, colorDark, scale);
      setPixel(ctx, ox + 8, oy + 8, colorDark, scale);
      break;
    default:
      break;
  }
}

function drawHair(ctx, styleIndex, colorIndex, ox, oy, scale) {
  const color = HAIR_COLORS[colorIndex] || HAIR_COLORS[0];
  const colorLight = lightenColor(color, 20);

  switch (styleIndex) {
    case 0: // Short
      for (let x = 5; x <= 10; x++) {
        setPixel(ctx, ox + x, oy + 0, color, scale);
        setPixel(ctx, ox + x, oy + 1, color, scale);
      }
      setPixel(ctx, ox + 4, oy + 1, color, scale);
      setPixel(ctx, ox + 11, oy + 1, color, scale);
      break;

    case 1: // Long
      for (let x = 5; x <= 10; x++) {
        setPixel(ctx, ox + x, oy + 0, color, scale);
        setPixel(ctx, ox + x, oy + 1, color, scale);
      }
      for (let y = 2; y <= 8; y++) {
        setPixel(ctx, ox + 4, oy + y, color, scale);
        setPixel(ctx, ox + 11, oy + y, color, scale);
      }
      break;

    case 2: // Curly
      for (let x = 4; x <= 11; x++) {
        setPixel(ctx, ox + x, oy + 0, color, scale);
      }
      for (let x = 4; x <= 11; x++) {
        setPixel(ctx, ox + x, oy + 1, (x % 2 === 0) ? color : colorLight, scale);
      }
      setPixel(ctx, ox + 4, oy + 2, color, scale);
      setPixel(ctx, ox + 11, oy + 2, color, scale);
      setPixel(ctx, ox + 4, oy + 3, colorLight, scale);
      setPixel(ctx, ox + 11, oy + 3, colorLight, scale);
      break;

    case 3: // Spiky
      for (let x = 5; x <= 10; x++) {
        setPixel(ctx, ox + x, oy + 1, color, scale);
      }
      setPixel(ctx, ox + 5, oy + 0, color, scale);
      setPixel(ctx, ox + 7, oy + 0, color, scale);
      setPixel(ctx, ox + 9, oy + 0, color, scale);
      break;

    case 4: // Buzz
      for (let x = 5; x <= 10; x++) {
        setPixel(ctx, ox + x, oy + 1, color, scale);
      }
      break;

    case 5: // Bob
      for (let x = 4; x <= 11; x++) {
        setPixel(ctx, ox + x, oy + 0, color, scale);
        setPixel(ctx, ox + x, oy + 1, color, scale);
      }
      for (let y = 2; y <= 5; y++) {
        setPixel(ctx, ox + 4, oy + y, color, scale);
        setPixel(ctx, ox + 11, oy + y, color, scale);
      }
      break;

    case 6: // Ponytail
      for (let x = 5; x <= 10; x++) {
        setPixel(ctx, ox + x, oy + 0, color, scale);
        setPixel(ctx, ox + x, oy + 1, color, scale);
      }
      // Tail going right
      setPixel(ctx, ox + 11, oy + 2, color, scale);
      setPixel(ctx, ox + 12, oy + 3, color, scale);
      setPixel(ctx, ox + 12, oy + 4, color, scale);
      setPixel(ctx, ox + 12, oy + 5, color, scale);
      break;

    case 7: // Mohawk
      for (let x = 6; x <= 9; x++) {
        setPixel(ctx, ox + x, oy + 0, color, scale);
      }
      setPixel(ctx, ox + 7, oy + 0, colorLight, scale);
      setPixel(ctx, ox + 8, oy + 0, colorLight, scale);
      break;

    default:
      break;
  }
}

function drawAccessory(ctx, accessoryIndex, ox, oy, scale) {
  switch (accessoryIndex) {
    case 0: // None
      break;

    case 1: // Glasses
      // Left lens
      setPixel(ctx, ox + 5, oy + 3, '#333333', scale);
      setPixel(ctx, ox + 6, oy + 3, '#87CEEB', scale);
      setPixel(ctx, ox + 7, oy + 3, '#333333', scale);
      // Bridge
      setPixel(ctx, ox + 7, oy + 3, '#333333', scale);
      setPixel(ctx, ox + 8, oy + 3, '#333333', scale);
      // Right lens
      setPixel(ctx, ox + 8, oy + 3, '#333333', scale);
      setPixel(ctx, ox + 9, oy + 3, '#87CEEB', scale);
      setPixel(ctx, ox + 10, oy + 3, '#333333', scale);
      // Frames
      setPixel(ctx, ox + 4, oy + 3, '#333333', scale);
      setPixel(ctx, ox + 11, oy + 3, '#333333', scale);
      break;

    case 2: // Gorra
      for (let x = 4; x <= 11; x++) {
        setPixel(ctx, ox + x, oy + 0, '#E74C3C', scale);
      }
      for (let x = 4; x <= 12; x++) {
        setPixel(ctx, ox + x, oy + 1, '#C0392B', scale);
      }
      // Visor
      setPixel(ctx, ox + 12, oy + 1, '#C0392B', scale);
      setPixel(ctx, ox + 13, oy + 1, '#C0392B', scale);
      break;

    case 3: // Auriculares
      setPixel(ctx, ox + 4, oy + 2, '#333333', scale);
      setPixel(ctx, ox + 4, oy + 3, '#555555', scale);
      setPixel(ctx, ox + 4, oy + 4, '#333333', scale);
      setPixel(ctx, ox + 11, oy + 2, '#333333', scale);
      setPixel(ctx, ox + 11, oy + 3, '#555555', scale);
      setPixel(ctx, ox + 11, oy + 4, '#333333', scale);
      // Headband
      for (let x = 5; x <= 10; x++) {
        setPixel(ctx, ox + x, oy + 0, '#333333', scale);
      }
      break;

    default:
      break;
  }
}

// Píxel en la rejilla de 32 del sprite nuevo (los indicadores llegan con scale = 2 × píxel de 32).
const p32 = (ctx, ox, oy, x, y, c, scale) => setPixel(ctx, ox * 2 + x, oy * 2 + y, c, scale / 2);
const VEIN = [[24, -4], [25, -4], [24, -3], [29, -4], [30, -4], [30, -3], [24, 1], [24, 2], [25, 2], [30, 1], [29, 2], [30, 2]];

// Representaciones visuales de estados de animo
export function drawRepresentation(ctx, representation, ox, oy, scale, frame) {
  switch (representation) {
    case 'llorando':
      // Lágrimas que caen por debajo de los ojos.
      for (const x of [11, 20]) {
        p32(ctx, ox, oy, x, 13 + (frame % 2), '#5DADE2', scale);
        p32(ctx, ox, oy, x, 14 + (frame % 2), '#5DADE2', scale);
      }
      break;

    case 'enfadado':
      // La vena de enfado (💢) junto a la cabeza.
      for (const [x, y] of VEIN) p32(ctx, ox, oy, x, y + (frame % 2), '#E8323C', scale);
      break;

    case 'somnoliento':
      // ZZZ burbujas
      {
        const zOff = frame % 4;
        ctx.fillStyle = '#A29BFE';
        ctx.font = `${scale * 2}px 'Press Start 2P', monospace`;
        ctx.fillText('z', (ox + 12) * scale, (oy + 1 - zOff) * scale);
        ctx.font = `${scale * 3}px 'Press Start 2P', monospace`;
        ctx.fillText('Z', (ox + 13) * scale, (oy - 1 - zOff) * scale);
      }
      break;

    case 'cantando':
      // Notas musicales flotando
      {
        const nOff = frame % 4;
        ctx.fillStyle = '#FFD700';
        ctx.font = `${scale * 3}px sans-serif`;
        ctx.fillText('\u266A', (ox + 12 + nOff) * scale, (oy - nOff) * scale);
        ctx.fillStyle = '#FFA500';
        ctx.font = `${scale * 2}px sans-serif`;
        ctx.fillText('\u266B', (ox + 2 - nOff) * scale, (oy + 1 - nOff) * scale);
      }
      break;

    case 'tirandose_del_pelo':
      // Manos arriba en la cabeza
      setPixel(ctx, ox + 5, oy + 0, '#FFA07A', scale);
      setPixel(ctx, ox + 10, oy + 0, '#FFA07A', scale);
      // Lineas de estres
      if (frame % 2 === 0) {
        setPixel(ctx, ox + 3, oy + 0, '#FF6B6B', scale);
        setPixel(ctx, ox + 12, oy + 0, '#FF6B6B', scale);
      }
      break;

    case 'nube_en_la_cabeza': {
      // Nube oscura sobre la cabeza
      const cloudY = oy - 2;
      for (let x = 5; x <= 10; x++) {
        setPixel(ctx, ox + x, cloudY, '#555555', scale);
      }
      for (let x = 6; x <= 9; x++) {
        setPixel(ctx, ox + x, cloudY - 1, '#666666', scale);
      }
      // Rayos
      if (frame % 3 === 0) {
        setPixel(ctx, ox + 7, cloudY + 1, '#FFD700', scale);
        setPixel(ctx, ox + 8, cloudY + 2, '#FFD700', scale);
      }
      break;
    }

    default:
      break;
  }
}

// Indicadores de accion del avatar
export function drawActionIndicator(ctx, action, ox, oy, scale, frame) {
  switch (action) {
    case 'durmiendo': {
      // Zzz encima de la cabeza (los ojos pintados caían fuera de la cara con los sprites nuevos).
      const zOff = frame % 4;
      ctx.fillStyle = '#A29BFE';
      ctx.font = `${scale * 3}px 'Press Start 2P', monospace`;
      ctx.fillText('z', (ox + 12) * scale, (oy - zOff) * scale);
      break;
    }

    case 'celebrando': {
      // Confeti encima de la cabeza (antes dos cuadrados de piel que parecían orejas).
      const conf = ['#FFE066', '#F7A8C8', '#8EC5FF'];
      for (let i = 0; i < 6; i++) p32(ctx, ox, oy, 6 + i * 4, -4 + ((i + frame) % 4), conf[i % 3], scale);
      break;
    }

    case 'rabieta':
      // Vapor saliendo de la cabeza (antes había puntos rojos a los pies que parecían sangre).
      for (const [x, y] of [[8, -2], [10, -4], [22, -2], [24, -4]]) p32(ctx, ox, oy, x, y - (frame % 2), '#E8ECF2', scale);
      break;

    case 'corriendo':
      // Gota de sudor
      if (frame % 2 === 0) {
        setPixel(ctx, ox + 12, oy + 2, '#87CEEB', scale);
      }
      break;

    case 'holgazaneando':
      // Sin marca: estar tranquilo no necesita dibujo (antes pintaba ojos fuera de sitio).
      break;

    default:
      break;
  }
}

// Lo que acompaña a comer, en la rejilla de 32: migas que caen (quien come rápido o se mancha),
// migas que salen volando (quien habla con la boca llena) y el vaho del táper recién calentado.
// mods: lo que sale de eatMods (SpriteSheet.js): { eat, food, frame, mouth }.
const CRUMB = '#E8C07A';
const HOT = ['pasta', 'arroz', 'lentejas', 'fideos'];
// Gestos (los manda el servidor en `gesture`; el teléfono también si hay llamada), cada uno con
// su estilo según `seed`: estirarse (los dos brazos o uno), el móvil (a la altura del pecho o
// delante de la cara) y el teléfono en la oreja (derecha o izquierda).
export function drawGesture(ctx, gesture, ox, oy, scale, frame, seed = 0, skin = '#E9AE85') {
  const st = Math.abs(seed | 0);
  if (gesture === 'estira') {
    const up = frame % 4 < 2 ? 0 : 1; // sube y baja un poco
    const both = st % 3 !== 0;
    for (const x of both ? [6, 25] : [25]) {
      for (let y = 5 + up; y <= 17; y++) p32(ctx, ox, oy, x, y, skin, scale);
      p32(ctx, ox, oy, x - 1, 4 + up, skin, scale); p32(ctx, ox, oy, x, 4 + up, skin, scale); p32(ctx, ox, oy, x + 1, 4 + up, skin, scale);
    }
  } else if (gesture === 'movil') {
    const y0 = st % 2 ? 19 : 15; // unos lo miran a la altura del pecho; otros, pegado a la cara
    for (let y = y0; y < y0 + 5; y++) for (let x = 13; x <= 18; x++) p32(ctx, ox, oy, x, y, x === 13 || x === 18 || y === y0 || y === y0 + 4 ? '#2B2F3D' : '#74B9FF', scale);
    if (frame % 3 === 0) p32(ctx, ox, oy, 15, y0 + 2, '#FFFFFF', scale); // algo se mueve en la pantalla
    p32(ctx, ox, oy, 12, y0 + 3, skin, scale); p32(ctx, ox, oy, 19, y0 + 3, skin, scale);
  } else if (gesture === 'telefono') {
    const x = st % 2 ? 24 : 6; // oreja derecha o izquierda
    for (let y = 9; y <= 15; y++) { p32(ctx, ox, oy, x, y, '#2B2F3D', scale); p32(ctx, ox, oy, x + (x > 16 ? 1 : -1), y, '#2B2F3D', scale); }
    p32(ctx, ox, oy, x, 10, '#74B9FF', scale);
    for (let y = 16; y <= 18; y++) p32(ctx, ox, oy, x, y, skin, scale); // la mano que lo sujeta
  }
}

export function drawEatIndicator(ctx, mods, ox, oy, scale, frame) {
  // Masticando: dos marcas a los lados de la cara que van y vienen; se ve también en el mapa (antes
  // el bocado y el masticado solo se distinguían en la lupa).
  if (mods.frame === 2 && frame % 2 === 0) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    for (const [x, y] of [[6, 12], [6, 14], [25, 12], [25, 14]]) p32(ctx, ox, oy, x, y, '#FFFFFF', scale);
    ctx.restore();
  }
  const style = mods.eat;
  if ((style === 'rapido' || style === 'mancha' || style === 'bocata') && mods.frame === 2) {
    const k = frame % 3;
    p32(ctx, ox, oy, 13, 17 + k, CRUMB, scale);
    p32(ctx, ox, oy, 18, 18 + ((k + 1) % 3), CRUMB, scale);
  }
  if (style === 'habla' && mods.mouth === 'open') {
    const k = frame % 3;
    p32(ctx, ox, oy, 19 + k, 14 - k, CRUMB, scale);
    p32(ctx, ox, oy, 20 + k, 16 - k, CRUMB, scale);
  }
  if (HOT.includes(mods.food) && mods.frame === 0 && style !== 'bocata') {
    // vaho: dos volutas que suben del táper y se desvanecen
    const k = frame % 4;
    ctx.save();
    ctx.globalAlpha = 0.55 - k * 0.12;
    p32(ctx, ox, oy, 14 + (k % 2), 19 - k, '#FFFFFF', scale);
    p32(ctx, ox, oy, 17 - (k % 2), 18 - k, '#FFFFFF', scale);
    ctx.restore();
  }
}

export function drawAvatar(ctx, config, ox, oy, scale) {
  drawBody(ctx, config.skinTone || 0, ox, oy, scale);
  drawClothes(ctx, config.clothes || 0, ox, oy, scale);
  drawHair(ctx, config.hairStyle || 0, config.hairColor || 0, ox, oy, scale);
  drawAccessory(ctx, config.accessory || 0, ox, oy, scale);
}

// --- Color utility functions ---

function darkenColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
  const b = Math.max(0, (num & 0x0000FF) - amount);
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

function lightenColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + amount);
  const b = Math.min(255, (num & 0x0000FF) + amount);
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}
