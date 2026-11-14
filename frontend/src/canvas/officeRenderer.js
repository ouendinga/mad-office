/**
 * Renderer de la oficina: tilemap + cámara + personajes ordenados por Y + bocadillos.
 * Las posiciones vienen del servidor (la simulación); aquí solo se interpolan.
 */

import Camera from '../engine/Camera';
import TileMap from '../engine/TileMap';
import { TILE_SIZE } from '../engine/TileSet';
import { renderAvatar } from '../engine/SpriteSheet';
import officeMapData from '../assets/maps/office.json';

const AVATAR_SCALE = 1.5;
const SPRITE = 32 * AVATAR_SCALE;

let tileMap = null;
let camera = null;
const shown = {}; // id -> {x, y} interpolada

function ensureInit(w, h) {
  if (!tileMap) tileMap = new TileMap(officeMapData);
  if (!camera) camera = new Camera(w, h, tileMap.pixelW, tileMap.pixelH);
  camera.resize(w, h);
  // Que quepa el mapa entero, centrado.
  camera.zoom = Math.min(w / tileMap.pixelW, h / tileMap.pixelH);
  camera.x = -(w / camera.zoom - tileMap.pixelW) / 2;
  camera.y = -(h / camera.zoom - tileMap.pixelH) / 2;
}

function displayPos(c) {
  const p = shown[c.id] || (shown[c.id] = { x: c.x, y: c.y });
  const dx = c.x - p.x;
  const dy = c.y - p.y;
  const dist = Math.hypot(dx, dy);
  const step = 2.2; // px por frame: andan, no se teletransportan
  if (dist <= step) {
    p.x = c.x;
    p.y = c.y;
    p.moving = false;
  } else {
    p.x += (dx / dist) * step;
    p.y += (dy / dist) * step;
    p.moving = true;
  }
  return p;
}

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function bubble(ctx, text, cx, top) {
  ctx.font = '600 9px Inter, sans-serif';
  const lines = wrap(ctx, text, 150);
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 12;
  const h = lines.length * 11 + 8;
  const x = Math.round(cx - w / 2);
  const y = Math.round(top - h - 8);
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1A1A2E';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 5); else ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 4, y + h);
  ctx.lineTo(cx, y + h + 6);
  ctx.lineTo(cx + 4, y + h);
  ctx.fill();
  ctx.fillStyle = '#1A1A2E';
  ctx.textAlign = 'left';
  lines.forEach((l, i) => ctx.fillText(l, x + 6, y + 13 + i * 11));
}

export function renderOffice(ctx, canvas, world, animFrame, selectedId) {
  const w = canvas.width;
  const h = canvas.height;
  ensureInit(w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0D0D1A';
  ctx.fillRect(0, 0, w, h);

  camera.applyTransform(ctx);
  tileMap.renderLayer(ctx, camera, 'floor');
  tileMap.renderLayer(ctx, camera, 'walls');
  tileMap.renderLayer(ctx, camera, 'furniture');

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  for (const z of tileMap.zones) {
    const label = z.name === 'break' ? 'Café' : z.label;
    ctx.fillText(label, z.x * TILE_SIZE + (z.w * TILE_SIZE) / 2, z.y * TILE_SIZE + 14);
  }

  const night = !world || world.clock.block === 'noche';
  const chars = world ? world.characters.filter(c => !c.home) : [];
  const drawn = chars.map(c => ({ c, p: displayPos(c) })).sort((a, b) => a.p.y - b.p.y);

  for (const { c, p } of drawn) {
    const action = p.moving ? 'paseando' : c.action;
    renderAvatar(ctx, c.avatar_config || {}, p.x, p.y, AVATAR_SCALE, animFrame, action, c.representation);
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillStyle = c.id === selectedId ? '#FDCB6E' : '#FFFFFF';
    ctx.fillText(c.name, p.x + SPRITE / 2, p.y + SPRITE + 9);
    ctx.shadowBlur = 0;
  }
  // Bocadillos encima de todo.
  for (const { c, p } of drawn) if (c.bubble) bubble(ctx, c.bubble, p.x + SPRITE / 2, p.y);

  if (night) {
    ctx.fillStyle = 'rgba(5, 5, 25, 0.72)';
    ctx.fillRect(0, 0, tileMap.pixelW, tileMap.pixelH);
    ctx.fillStyle = '#B8B8D4';
    ctx.font = '600 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💤 Todos en casa, soñando', tileMap.pixelW / 2, tileMap.pixelH / 2 - 8);
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = '#6C6C8A';
    ctx.fillText('La oficina abre a las 9:00 (de lunes a viernes)', tileMap.pixelW / 2, tileMap.pixelH / 2 + 14);
  }
  ctx.textAlign = 'left';
  camera.restore(ctx);
}

// Personaje bajo el ratón (coordenadas de pantalla del canvas).
export function pickAt(world, sx, sy) {
  if (!camera || !world) return null;
  const p = camera.screenToWorld(sx, sy);
  const hits = world.characters.filter(c => !c.home).filter(c => {
    const s = shown[c.id] || c;
    return p.x >= s.x - 4 && p.x <= s.x + SPRITE + 4 && p.y >= s.y - 4 && p.y <= s.y + SPRITE + 12;
  });
  return hits.length ? hits[hits.length - 1] : null;
}
