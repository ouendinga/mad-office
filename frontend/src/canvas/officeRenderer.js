/**
 * Renderer de la oficina.
 * La escena se pinta a resolución de arte (16 px por casilla) en un lienzo propio y se escala
 * a pantalla sin suavizar. Muebles y personajes se ordenan por profundidad (Y de los pies),
 * así las mesas tapan las piernas de quien está detrás. Textos y bocadillos se dibujan
 * después, a resolución de pantalla, para que se lean nítidos.
 *
 * Coordenadas: el servidor manda píxeles de mundo (32 por casilla, los pies del personaje);
 * aquí se dividen entre 2.
 */

import officeMap from '../assets/maps/office.json';
import { buildStatic, objectSprite, objectDef, roomAt, T } from '../engine/OfficeArt';
import { renderAvatar } from '../engine/SpriteSheet';
import { makeCanvas } from '../engine/pixel';

export const ART_W = officeMap.cols * T;
export const ART_H = officeMap.rows * T;
const WORLD_TO_ART = 0.5;

let staticLayer = null;
let scene = null;
let dynamicObjects = [];
let overlayObjects = [];
let lights = [];
let view = { scale: 1, ox: 0, oy: 0 };
const shown = {}; // id -> {x, y, moving} en píxeles de arte

function init() {
  if (staticLayer) return;
  staticLayer = buildStatic(officeMap);
  const sctx = staticLayer.getContext('2d');
  officeMap.objects.forEach((o, i) => {
    const d = objectDef(o.type);
    if (!d) return;
    const base = { o, seed: i + 1, d, x: o.x * T, y: o.y * T, baseY: (o.y + (o.h || 1)) * T };
    if (d.light) lights.push({ x: o.x * T + d.light.dx, y: o.y * T + d.light.dy, r: d.light.r, color: d.light.color || '255,214,140' });
    if (d.flat || d.wall) {
      const s = objectSprite(o, i + 1);
      sctx.drawImage(s.canvas, base.x + s.dx, base.y + s.dy);
    } else if (d.overlay) {
      overlayObjects.push(base);
      if (d.lightRow) for (let x = 4; x < (o.w || 1) * T; x += 8) lights.push({ x: base.x + x, y: base.y + 4, r: 12, color: '255,220,150' });
    } else {
      dynamicObjects.push(base);
    }
  });
  // Ventanas: de noche dejan una luz azulada de la calle.
  scene = makeCanvas(ART_W, ART_H);
}

function step(c) {
  const tx = c.x * WORLD_TO_ART;
  const ty = c.y * WORLD_TO_ART;
  const p = shown[c.id] || (shown[c.id] = { x: tx, y: ty, moving: false });
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dist = Math.hypot(dx, dy);
  const speed = 0.9; // px de arte por frame: andan, no se teletransportan
  if (dist <= speed) {
    p.x = tx; p.y = ty; p.moving = false;
  } else {
    p.x += (dx / dist) * speed; p.y += (dy / dist) * speed; p.moving = true;
  }
  return p;
}

function drawSprite(ctx, item, now) {
  const frames = item.d.frames || 1;
  const frame = frames > 1 ? Math.floor(now / 650 + item.seed) % frames : 0;
  const s = objectSprite(item.o, item.seed, frame);
  ctx.drawImage(s.canvas, item.x + s.dx, item.y + s.dy);
}

function paintScene(world, animFrame, now) {
  const ctx = scene.ctx;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(staticLayer, 0, 0);
  const night = !world || world.clock.block === 'noche';

  const items = dynamicObjects.map(o => ({ y: o.baseY, draw: () => drawSprite(ctx, o, now) }));
  const people = [];
  if (world && !night) {
    for (const c of world.characters) {
      if (c.home) continue;
      const p = step(c);
      people.push({ c, p });
      items.push({
        y: p.y,
        draw: () => renderAvatar(ctx, c.avatar_config || {}, Math.round(p.x - 16), Math.round(p.y - 30), 1,
          animFrame, p.moving ? 'paseando' : c.action, c.representation),
      });
    }
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();
  for (const o of overlayObjects) drawSprite(ctx, o, now);

  if (night) {
    ctx.fillStyle = 'rgba(14, 20, 62, 0.62)';
    ctx.fillRect(0, 0, ART_W, ART_H);
    ctx.globalCompositeOperation = 'lighter';
    const flicker = 0.9 + Math.sin(now / 900) * 0.06;
    for (const l of lights) {
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(${l.color},${0.45 * flicker})`);
      g.addColorStop(1, `rgba(${l.color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  return people;
}

function pill(ctx, text, x, y, { bg = 'rgba(30,22,40,0.78)', fg = '#FFFFFF', font = '600 11px Inter, sans-serif' } = {}) {
  ctx.font = font;
  const w = ctx.measureText(text).width + 12;
  const h = 18;
  ctx.fillStyle = bg;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(Math.round(x - w / 2), Math.round(y), w, h, 9); else ctx.rect(x - w / 2, y, w, h);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, Math.round(x), Math.round(y + h / 2 + 1));
  ctx.textBaseline = 'alphabetic';
}

function wrap(ctx, text, maxW) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

// Bocadillo de cómic con borde «pixelado»: esquinas recortadas y rabito.
function bubble(ctx, text, cx, bottom) {
  ctx.font = '600 12px Inter, sans-serif';
  const lines = wrap(ctx, text, 190);
  const w = Math.ceil(Math.max(...lines.map(l => ctx.measureText(l).width))) + 18;
  const h = lines.length * 15 + 12;
  const x = Math.round(Math.min(Math.max(cx - w / 2, 4), ctx.canvas.width - w - 4));
  const y = Math.round(bottom - h - 10);
  const B = '#2A1F2D';
  ctx.fillStyle = B;
  ctx.fillRect(x + 3, y, w - 6, h);
  ctx.fillRect(x, y + 3, w, h - 6);
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = '#FFFDF5';
  ctx.fillRect(x + 4, y + 2, w - 8, h - 4);
  ctx.fillRect(x + 2, y + 4, w - 4, h - 8);
  // rabito
  ctx.fillStyle = B;
  ctx.fillRect(cx - 5, y + h - 1, 10, 3);
  ctx.fillRect(cx - 3, y + h + 2, 6, 3);
  ctx.fillRect(cx - 1, y + h + 5, 3, 3);
  ctx.fillStyle = '#FFFDF5';
  ctx.fillRect(cx - 3, y + h - 2, 6, 3);
  ctx.fillRect(cx - 1, y + h + 1, 2, 3);
  ctx.fillStyle = '#2A1F2D';
  ctx.textAlign = 'left';
  lines.forEach((l, i) => ctx.fillText(l, x + 9, y + 18 + i * 15));
}

export function renderOffice(ctx, canvas, world, animFrame, selectedId) {
  init();
  const now = performance.now();
  const w = canvas.width;
  const h = canvas.height;
  const scale = Math.min(w / ART_W, h / ART_H);
  const ox = Math.floor((w - ART_W * scale) / 2);
  const oy = Math.floor((h - ART_H * scale) / 2);
  view = { scale, ox, oy };

  const people = paintScene(world, animFrame, now);

  ctx.fillStyle = '#1B1626';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scene.canvas, ox, oy, ART_W * scale, ART_H * scale);

  const S = (x, y) => [ox + x * scale, oy + y * scale];

  // Rótulos de las salas
  for (const r of officeMap.rooms) {
    if (!r.label || scale < 0.9) continue; // en pantallas pequeñas se pisan
    const [x, y] = S((r.x + r.w / 2) * T, r.y * T + 3);
    pill(ctx, r.label, x, y, { font: '700 10px Inter, sans-serif', bg: 'rgba(30,22,40,0.62)' });
  }

  // Nombres y bocadillos
  for (const { c, p } of people) {
    const [x, y] = S(p.x, p.y);
    const isSel = c.id === selectedId;
    pill(ctx, c.name, x, y + 3, {
      font: '700 10px Inter, sans-serif',
      bg: isSel ? 'rgba(242,193,78,0.95)' : 'rgba(30,22,40,0.72)',
      fg: isSel ? '#2A1F2D' : '#FFFFFF',
    });
  }
  for (const { c, p } of people) {
    if (!c.bubble || c.id === selectedId) continue;
    const [x, y] = S(p.x, p.y - 31);
    bubble(ctx, c.bubble, x, y);
  }

  if (selectedId != null) {
    const sel = people.find(x => x.c.id === selectedId);
    if (sel) drawLupa(ctx, w, h, sel.p, scale);
  }
}

// La «lupa»: la sala vista de cerca, en un círculo, con el resto de la oficina en penumbra.
function drawLupa(ctx, w, h, p, scale) {
  const R = Math.round(Math.min(w, h) * 0.3);
  const cx = Math.round(w / 2);
  const cy = Math.round(h / 2 + R * 0.25);
  const zoom = Math.max(scale * 2.2, 3); // px de pantalla por px de arte
  const half = R / zoom;
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,20,0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scene.canvas, p.x - half, p.y - 12 - half, half * 2, half * 2, cx - R, cy - R, R * 2, R * 2);
  ctx.restore();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#2A1F2D';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#F2C14E';
  ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, Math.PI * 2); ctx.stroke();
}

// Personaje bajo el ratón (coordenadas de pantalla del canvas).
export function pickAt(world, sx, sy) {
  if (!world) return null;
  const ax = (sx - view.ox) / view.scale;
  const ay = (sy - view.oy) / view.scale;
  const hits = world.characters.filter(c => !c.home && shown[c.id]).filter(c => {
    const s = shown[c.id];
    return Math.abs(ax - s.x) <= 10 && ay >= s.y - 30 && ay <= s.y + 6;
  });
  hits.sort((a, b) => shown[b.id].y - shown[a.id].y);
  return hits[0] || null;
}

// Nombre de la sala donde está un personaje (para la caja de diálogo).
export function roomLabelOf(c) {
  const s = shown[c.id] || { x: c.x * WORLD_TO_ART, y: c.y * WORLD_TO_ART };
  const r = roomAt(officeMap, Math.floor(s.x / T), Math.floor((s.y - 1) / T));
  return r ? (r.label || 'Pasillo') : 'Pasillo';
}
