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

// Mood representation overlays
export function drawRepresentation(ctx, representation, ox, oy, scale, frame) {
  switch (representation) {
    case 'smiling':
      // Already handled in base mouth
      break;

    case 'sparkles':
      if (frame % 2 === 0) {
        setPixel(ctx, ox + 3, oy + 0, '#FFD700', scale);
        setPixel(ctx, ox + 13, oy + 2, '#FFD700', scale);
      } else {
        setPixel(ctx, ox + 2, oy + 1, '#FFD700', scale);
        setPixel(ctx, ox + 14, oy + 1, '#FFD700', scale);
      }
      break;

    case 'sweat_drop':
      setPixel(ctx, ox + 12, oy + 2, '#87CEEB', scale);
      setPixel(ctx, ox + 12, oy + 3, '#87CEEB', scale);
      break;

    case 'steam':
      const steamOffset = frame % 3;
      setPixel(ctx, ox + 6 + steamOffset, oy - 1, '#CCCCCC', scale);
      setPixel(ctx, ox + 8 - steamOffset, oy - 2, '#AAAAAA', scale);
      break;

    case 'anger_cloud': {
      // Cloud above head
      const cloudY = oy - 2;
      for (let x = 5; x <= 10; x++) {
        setPixel(ctx, ox + x, cloudY, '#555555', scale);
      }
      for (let x = 6; x <= 9; x++) {
        setPixel(ctx, ox + x, cloudY - 1, '#666666', scale);
      }
      // Lightning
      if (frame % 3 === 0) {
        setPixel(ctx, ox + 7, cloudY + 1, '#FFD700', scale);
        setPixel(ctx, ox + 8, cloudY + 2, '#FFD700', scale);
      }
      break;
    }

    case 'red_face':
      setPixel(ctx, ox + 5, oy + 4, '#FF6B6B', scale);
      setPixel(ctx, ox + 10, oy + 4, '#FF6B6B', scale);
      break;

    case 'tear':
      setPixel(ctx, ox + 6, oy + 4 + (frame % 2), '#87CEEB', scale);
      break;

    case 'rain_cloud': {
      for (let x = 5; x <= 10; x++) {
        setPixel(ctx, ox + x, oy - 2, '#4A6FA5', scale);
      }
      // Rain drops
      const rainOff = frame % 2;
      setPixel(ctx, ox + 6, oy - 1 + rainOff, '#87CEEB', scale);
      setPixel(ctx, ox + 8, oy + rainOff, '#87CEEB', scale);
      setPixel(ctx, ox + 10, oy - 1 + rainOff, '#87CEEB', scale);
      break;
    }

    case 'yawning':
      // Open mouth
      setPixel(ctx, ox + 7, oy + 5, '#8B0000', scale);
      setPixel(ctx, ox + 8, oy + 5, '#8B0000', scale);
      setPixel(ctx, ox + 7, oy + 6, '#8B0000', scale);
      setPixel(ctx, ox + 8, oy + 6, '#8B0000', scale);
      break;

    case 'zzz_bubbles': {
      const zOff = frame % 4;
      ctx.fillStyle = '#A29BFE';
      ctx.font = `${scale * 2}px 'Press Start 2P', monospace`;
      ctx.fillText('z', (ox + 12) * scale, (oy + 1 - zOff) * scale);
      ctx.font = `${scale * 3}px 'Press Start 2P', monospace`;
      ctx.fillText('Z', (ox + 13) * scale, (oy - 1 - zOff) * scale);
      break;
    }

    case 'bouncing':
      // Handled by position offset in office renderer
      break;

    case 'stars': {
      const sOff = frame % 4;
      setPixel(ctx, ox + 2 + sOff, oy + 0, '#FFD700', scale);
      setPixel(ctx, ox + 12 - sOff, oy - 1, '#FFD700', scale);
      setPixel(ctx, ox + 1, oy + 2 + sOff, '#FFA500', scale);
      break;
    }

    default:
      break;
  }
}

// Draw action indicator
export function drawActionIndicator(ctx, action, ox, oy, scale, frame) {
  switch (action) {
    case 'sleeping':
      // Closed eyes
      setPixel(ctx, ox + 6, oy + 3, '#1A1A2E', scale);
      setPixel(ctx, ox + 7, oy + 3, '#1A1A2E', scale);
      setPixel(ctx, ox + 8, oy + 3, '#1A1A2E', scale);
      setPixel(ctx, ox + 9, oy + 3, '#1A1A2E', scale);
      break;

    case 'working_hard':
      // Sweat drop
      if (frame % 4 < 2) {
        setPixel(ctx, ox + 12, oy + 2, '#87CEEB', scale);
      }
      break;

    case 'celebrating':
      // Raised arms (override)
      setPixel(ctx, ox + 3, oy + 7, SKIN_TONES[0], scale);
      setPixel(ctx, ox + 12, oy + 7, SKIN_TONES[0], scale);
      break;

    case 'crying':
      // Tears on both sides
      setPixel(ctx, ox + 5, oy + 4 + (frame % 2), '#87CEEB', scale);
      setPixel(ctx, ox + 10, oy + 4 + (frame % 2), '#87CEEB', scale);
      break;

    case 'raging':
      // Red tint + steam
      setPixel(ctx, ox + 5, oy + 4, '#FF0000', scale);
      setPixel(ctx, ox + 10, oy + 4, '#FF0000', scale);
      if (frame % 2 === 0) {
        setPixel(ctx, ox + 6, oy - 1, '#FF4444', scale);
        setPixel(ctx, ox + 9, oy - 1, '#FF4444', scale);
      }
      break;

    default:
      break;
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
