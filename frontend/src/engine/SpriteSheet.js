/**
 * SpriteSheet — Sistema de avatares con animacion de walk y cache.
 * Genera sprites 16x16 y los cachea en offscreen canvas.
 * Walk animation: 2 frames alternando piernas.
 */

import { drawRepresentation, drawActionIndicator, drawEatIndicator, drawGesture } from '../canvas/avatarSprites';
import { drawCharacter, SKIN_TONES } from './Character';

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

// Ritmo de cada forma de comer (fotogramas de animación, ~7,5 por segundo): 0 = con la comida
// delante, 1 = bocado, 2 = masticando. El estilo lo manda el servidor; esto es solo cómo se ve.
export const EAT_RHYTHM = {
  rapido: [0, 1, 2, 0, 1, 2, 0, 1, 2, 2, 0, 1, 2, 0],
  bocaditos: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  taper: [0, 0, 0, 0, 0, 1, 1, 2, 0, 2, 0, 2, 0, 0, 0, 0],
  mancha: [0, 0, 0, 1, 1, 2, 0, 2, 0, 0, 0, 0],
  palillos: [0, 0, 0, 0, 1, 1, 2, 0, 2, 0, 0, 0, 0],
  movil: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 0, 2, 0, 0, 0],
  habla: [0, 0, 1, 1, 2, 0, 2, 0, 0, 0],
  bocata: [0, 0, 0, 0, 1, 1, 1, 2, 0, 2, 0, 2, 0, 0, 0],
};
// Hablando: la boca se abre y se cierra (sin compás fijo, como al hablar de verdad).
const TALK_MOUTH = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1];

// Qué dibujar de comer y hablar en este fotograma. extra: { eat, talking, seed }.
export function eatMods(extra, animFrame) {
  if (!extra || (!extra.eat && !extra.talking)) return null;
  const t = animFrame + ((extra.seed | 0) * 7);
  const open = extra.talking && TALK_MOUTH[t % TALK_MOUTH.length] === 1;
  if (!extra.eat) return open ? { mouth: 'open' } : null;
  const rhythm = EAT_RHYTHM[extra.eat.style] || EAT_RHYTHM.taper;
  let frame = rhythm[t % rhythm.length];
  // Hablando no se da un bocado (salvo el que habla con la boca llena, que mastica y habla).
  if (extra.talking && frame === 1) frame = 0;
  if (open && extra.eat.style !== 'habla') frame = 0;
  return { eat: extra.eat.style, food: extra.eat.food, frame, mouth: open ? 'open' : null };
}

/**
 * Renderizar avatar completo en el canvas del juego.
 * Usa cache para el sprite base y dibuja overlays (representaciones, acciones).
 * extra (opcional): { eat: {style, food}, talking, seed } — comiendo y hablando (lo manda el servidor).
 */
export function renderAvatar(ctx, config, worldX, worldY, scale, animFrame, action, representation, extra = null) {
  const isWalking = action === 'corriendo' || action === 'paseando';
  const pose = isWalking ? (animFrame % 2 === 0 ? 'walk1' : 'walk2') : 'idle';
  let yOffset = 0;
  if (action === 'celebrando' || action === 'corriendo') yOffset = Math.sin(animFrame * 0.3) * 3;
  const dx = Math.round(worldX);
  const dy = Math.round(worldY + yOffset);
  // Andando no se come (se guarda el táper para cuando llegue).
  const mods = isWalking ? null : eatMods(extra, animFrame);
  drawCharacter(ctx, config, dx, dy, scale, pose, mods);

  // Los indicadores de acción y estado están dibujados sobre una rejilla de 16: doble escala.
  ctx.save();
  ctx.translate(dx, dy);
  if (action) drawActionIndicator(ctx, action, 0, 0, scale * 2, animFrame);
  if (representation) drawRepresentation(ctx, representation, 0, 0, scale * 2, animFrame);
  if (mods && mods.eat) drawEatIndicator(ctx, mods, 0, 0, scale * 2, animFrame);
  if (extra && extra.gesture && !isWalking && !(mods && mods.eat)) {
    const skin = SKIN_TONES[(config.skinTone | 0) % SKIN_TONES.length];
    drawGesture(ctx, extra.gesture, 0, 0, scale * 2, animFrame, extra.seed, skin);
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
