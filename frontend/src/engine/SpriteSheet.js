/**
 * SpriteSheet — Sistema de avatares con animacion de walk y cache.
 * Genera sprites 16x16 y los cachea en offscreen canvas.
 * Walk animation: 2 frames alternando piernas.
 */

import {
  SKIN_TONES, HAIR_COLORS, CLOTHES, ACCESSORIES,
  drawAvatar, drawRepresentation, drawActionIndicator
} from '../canvas/avatarSprites';

const SPRITE_BASE = 16;   // Tamano base del sprite en pixels
const CACHE = new Map();

/** Genera una key unica para una config de avatar */
function configKey(config, pose) {
  const s = config.skinTone || 0;
  const c = config.clothes || 0;
  const h = config.hairStyle || 0;
  const hc = config.hairColor || 0;
  const a = config.accessory || 0;
  return `${s}-${c}-${h}-${hc}-${a}-${pose}`;
}

/** Obtener (o generar) un sprite cacheado para una config + pose */
export function getCachedSprite(config, pose = 'idle') {
  const key = configKey(config, pose);
  if (CACHE.has(key)) return CACHE.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_BASE;
  canvas.height = SPRITE_BASE;
  const ctx = canvas.getContext('2d');

  // Dibujar avatar base a escala 1:1
  drawAvatar(ctx, config, 0, 0, 1);

  // Aplicar variacion de pose
  if (pose === 'walk1') {
    applyWalkFrame1(ctx, config);
  } else if (pose === 'walk2') {
    applyWalkFrame2(ctx, config);
  }

  CACHE.set(key, canvas);
  return canvas;
}

/** Modificar sprite para frame 1 de walk (pierna izq adelante) */
function applyWalkFrame1(ctx, config) {
  const skin = SKIN_TONES[config.skinTone || 0];
  // Mover pierna izq abajo-1, pierna der arriba+1
  ctx.fillStyle = '#1A1A2E'; // Limpiar pies originales
  ctx.clearRect(4, 14, 3, 2);
  ctx.clearRect(9, 14, 3, 2);
  // Pierna izq adelante
  ctx.fillStyle = darken(skin, 30);
  px(ctx, 4, 13, 3, 1);
  px(ctx, 4, 14, 3, 1);
  // Pierna der atras
  px(ctx, 9, 14, 3, 1);
  px(ctx, 9, 15, 3, 1);
  // Pies
  ctx.fillStyle = '#4A4A4A';
  px(ctx, 4, 15, 3, 1);
  // Pie der un poco retrasado (no visible, ya ok)
}

/** Frame 2 de walk (pierna der adelante) */
function applyWalkFrame2(ctx, config) {
  const skin = SKIN_TONES[config.skinTone || 0];
  ctx.clearRect(4, 14, 3, 2);
  ctx.clearRect(9, 14, 3, 2);
  ctx.fillStyle = darken(skin, 30);
  px(ctx, 9, 13, 3, 1);
  px(ctx, 9, 14, 3, 1);
  px(ctx, 4, 14, 3, 1);
  px(ctx, 4, 15, 3, 1);
  ctx.fillStyle = '#4A4A4A';
  px(ctx, 9, 15, 3, 1);
}

/**
 * Renderizar avatar completo en el canvas del juego.
 * Usa cache para el sprite base y dibuja overlays (representaciones, acciones).
 */
export function renderAvatar(ctx, config, worldX, worldY, scale, animFrame, action, representation) {
  const isWalking = action === 'corriendo' || action === 'paseando';
  let pose = 'idle';
  if (isWalking) {
    pose = animFrame % 2 === 0 ? 'walk1' : 'walk2';
  }

  const sprite = getCachedSprite(config, pose);

  // Bounce para celebrando/corriendo
  let yOffset = 0;
  if (action === 'celebrando' || action === 'corriendo') {
    yOffset = Math.sin(animFrame * 0.3) * 3;
  }

  const dx = Math.round(worldX);
  const dy = Math.round(worldY + yOffset);

  // Dibujar sprite escalado sin antialiasing
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, dx, dy, SPRITE_BASE * scale, SPRITE_BASE * scale);

  // Overlays de accion y representacion (estos se dibujan pixel a pixel, sobre el sprite)
  ctx.save();
  ctx.translate(dx, dy);
  if (action) {
    drawActionIndicator(ctx, action, 0, 0, scale, animFrame);
  }
  if (representation) {
    drawRepresentation(ctx, representation, 0, 0, scale, animFrame);
  }
  ctx.restore();
}

/** Limpiar cache (al cambiar avatar) */
export function clearSpriteCache() {
  CACHE.clear();
}

/** Invalidar cache de un avatar concreto */
export function invalidateAvatar(config) {
  const poses = ['idle', 'walk1', 'walk2'];
  for (const pose of poses) {
    CACHE.delete(configKey(config, pose));
  }
}

// --- Helpers ---

function px(ctx, x, y, w, h) {
  ctx.fillRect(x, y, w, h);
}

function darken(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xFF) - amount);
  const b = Math.max(0, (num & 0xFF) - amount);
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}
