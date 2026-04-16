/**
 * Office Map Renderer v3 — Tilemap + Camera + Z-sorting
 * Usa engine/TileMap para renderizar capas de tiles cacheadas,
 * engine/Camera para viewport con scroll, y z-sorting por coordenada Y.
 */

import Camera from '../engine/Camera';
import TileMap from '../engine/TileMap';
import { TILE_SIZE } from '../engine/TileSet';
import { renderAvatar } from '../engine/SpriteSheet';
import officeMapData from '../assets/maps/office.json';

// --- Constantes ---

const AVATAR_SCALE = 3;

export const MOOD_COLORS = {
  alegria: '#00B894',
  energia: '#FDCB6E',
  optimismo: '#6C5CE7',
  frustracion: '#D63031',
  estres: '#E17055',
  neutral: '#6C6C8A',
};

// --- Singleton del mapa y camara ---

let tileMap = null;
let camera = null;

function ensureInit(canvasW, canvasH) {
  if (!tileMap) {
    tileMap = new TileMap(officeMapData);
  }
  if (!camera) {
    camera = new Camera(canvasW, canvasH, tileMap.pixelW, tileMap.pixelH);
    camera.zoom = Math.min(canvasW / tileMap.pixelW, canvasH / tileMap.pixelH);
    if (camera.zoom < 1) camera.zoom = Math.max(camera.zoom, 0.6);
    // Centrar mapa inicialmente
    camera.follow(tileMap.pixelW / 2, tileMap.pixelH / 2);
    camera.x = camera.targetX;
    camera.y = camera.targetY;
  }
  camera.resize(canvasW, canvasH);
}

// --- Posiciones interpoladas de avatares ---

const avatarPositions = {};

function getAvatarDisplayPos(user) {
  const userId = user.id;

  let targetX, targetY;
  if (user.position_x !== null && user.position_x !== undefined) {
    // Convertir posiciones legacy (800x600) a coordenadas del nuevo mapa
    targetX = (user.position_x / 800) * tileMap.pixelW;
    targetY = (user.position_y / 600) * tileMap.pixelH;
  } else {
    const deskPos = tileMap.getDeskPosition(user.desk_index);
    if (deskPos) {
      targetX = deskPos.x;
      targetY = deskPos.y;
    } else {
      targetX = tileMap.pixelW / 2;
      targetY = tileMap.pixelH / 2;
    }
  }

  if (!avatarPositions[userId]) {
    avatarPositions[userId] = { x: targetX, y: targetY };
  }
  const pos = avatarPositions[userId];
  const speed = user.current_action === 'corriendo' ? 0.08 : 0.03;
  pos.x += (targetX - pos.x) * speed;
  pos.y += (targetY - pos.y) * speed;

  return pos;
}

// --- Mood helpers ---

function getDominantMood(user) {
  const moods = {
    alegria: user.alegria || 5,
    energia: user.energia || 5,
    optimismo: user.optimismo || 5,
    frustracion: user.frustracion || 5,
    estres: user.estres || 5,
  };
  let worst = 'neutral';
  let minVal = 10;
  for (const [key, val] of Object.entries(moods)) {
    if (val < minVal) { minVal = val; worst = key; }
  }
  return minVal < 4 ? worst : 'neutral';
}

// --- Render principal ---

export function renderOffice(ctx, canvas, users, animFrame, reactions, clock) {
  const w = canvas.width;
  const h = canvas.height;

  ensureInit(w, h);
  camera.update();

  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;

  // Fondo fuera del mapa
  ctx.fillStyle = '#0D0D1A';
  ctx.fillRect(0, 0, w, h);

  // Aplicar transformacion de camara
  camera.applyTransform(ctx);

  // Capa 1: Suelo
  tileMap.renderLayer(ctx, camera, 'floor');

  // Capa 2: Paredes
  tileMap.renderLayer(ctx, camera, 'walls');

  // Capa 3: Mobiliario (debajo de avatares)
  tileMap.renderLayer(ctx, camera, 'furniture');

  // Labels de zonas
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  for (const zone of tileMap.zones) {
    const zx = zone.x * TILE_SIZE + (zone.w * TILE_SIZE) / 2;
    const zy = zone.y * TILE_SIZE + 14;
    ctx.fillText(zone.label, zx, zy);
  }
  ctx.textAlign = 'left';

  // Night overlay
  const isNight = clock && !clock.working;
  if (isNight) {
    ctx.fillStyle = 'rgba(0, 0, 20, 0.5)';
    ctx.fillRect(0, 0, tileMap.pixelW, tileMap.pixelH);
    ctx.fillStyle = '#6C6C8A';
    ctx.font = '16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Fuera de horario laboral', tileMap.pixelW / 2, tileMap.pixelH / 2);
    ctx.textAlign = 'left';
  }

  // --- Avatares con Z-sorting ---
  if (users && !isNight) {
    // Calcular posiciones y ordenar por Y (profundidad)
    const avatarData = users.map(user => {
      const pos = getAvatarDisplayPos(user);
      return { user, pos };
    });
    avatarData.sort((a, b) => a.pos.y - b.pos.y);

    // Renderizar avatares
    for (const { user, pos } of avatarData) {
      const config = user.avatar_config || {};

      renderAvatar(
        ctx, config,
        pos.x, pos.y,
        AVATAR_SCALE,
        animFrame,
        user.current_action,
        user.current_representation
      );

      // Nombre
      const spriteW = 16 * AVATAR_SCALE;
      const spriteH = 16 * AVATAR_SCALE;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(user.name, pos.x + spriteW / 2, pos.y + spriteH + 12);

      // Mood dot
      const dominantMood = getDominantMood(user);
      ctx.beginPath();
      ctx.arc(pos.x + spriteW / 2, pos.y + spriteH + 20, 4, 0, Math.PI * 2);
      ctx.fillStyle = MOOD_COLORS[dominantMood] || '#6C6C8A';
      ctx.fill();
      ctx.textAlign = 'left';
    }

    // Emoji reactions flotantes
    if (reactions) {
      for (const r of reactions) {
        const u = users.find(u => u.id === r.userId);
        if (!u) continue;
        const pos = getAvatarDisplayPos(u);
        const elapsed = (Date.now() - r.timestamp) / 1000;
        const alpha = Math.max(0, 1 - elapsed / 3);
        const yOff = -elapsed * 20;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(r.emoji, pos.x + 24, pos.y + yOff - 5);
        ctx.restore();
      }
    }
  }

  // Restaurar transformacion de camara
  camera.restore(ctx);
}

// --- Exports para uso externo ---

export function getCamera() {
  return camera;
}

export function getTileMap() {
  return tileMap;
}

export { TILE_SIZE };

// Posiciones de desk compatibles con el sistema anterior
export const DESK_POSITIONS = officeMapData.desks.map(d => ({
  x: d.x * TILE_SIZE,
  y: d.y * TILE_SIZE,
}));

export const MAP_W = officeMapData.width * TILE_SIZE;
export const MAP_H = officeMapData.height * TILE_SIZE;
