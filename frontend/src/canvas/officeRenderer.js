/**
 * Renderer de la oficina.
 * La escena se pinta a resolución de arte (16 px por casilla) en un lienzo propio y se escala
 * a pantalla sin suavizar. Muebles y personajes se ordenan por profundidad (Y de los pies),
 * así las mesas tapan las piernas de quien está detrás. Textos y bocadillos se dibujan
 * después, a resolución de pantalla, para que se lean nítidos.
 *
 * Coordenadas: el servidor manda píxeles de mundo (32 por casilla, los pies del personaje);
 * aquí se dividen entre 2.
 *
 * El tiempo (clock.weather) y la estación (clock.season) cambian el dibujo: cristales de las
 * ventanas, terraza, árboles con viento. Al hacer clic en una sala se abre su vista de frente
 * (engine/RoomScenes) dentro de un círculo, como una lupa.
 */

import officeMap from '../assets/maps/office.json';
import { buildStatic, objectSprite, objectDef, roomAt, setSeason, T } from '../engine/OfficeArt';
import { renderAvatar } from '../engine/SpriteSheet';
import { drawVisitorProps } from '../engine/VisitorProps';
import { characterSprite } from '../engine/Character';
import { makeCanvas } from '../engine/pixel';
import { SW, SH, paintBack, paintFurniture, paintLight, slotsFor, sceneDef } from '../engine/RoomScenes';
import { buildWalkable, findPath } from './paths';
import { weatherKind, isWindy, drawPrecip, drawOutdoorTint, drawWindowGlass, seasonOf } from './weather';

export const ART_W = officeMap.cols * T;
export const ART_H = officeMap.rows * T;
const WORLD_TO_ART = 0.5;
// La terraza y el césped (lo que está a la intemperie), en px de arte.
const OUTDOOR = { x: 32 * T, y: 0, w: (officeMap.cols - 32) * T, h: ART_H };

let staticLayer = null;
let scene = null;
let lensScene = null;
let dynamicObjects = [];
let overlayObjects = [];
let windows = [];
let lights = [];
let view = { scale: 1, ox: 0, oy: 0 };
let lens = null; // última lupa pintada (para los clics): {cx, cy, R, k, x0, y0, people:[{id, x, y}]}
const shown = {}; // id -> {x, y, moving} en píxeles de arte

function rebuild() {
  staticLayer = buildStatic(officeMap);
  dynamicObjects = [];
  overlayObjects = [];
  windows = [];
  lights = [];
  const sctx = staticLayer.getContext('2d');
  officeMap.objects.forEach((o, i) => {
    const d = objectDef(o.type);
    if (!d) return;
    const base = { o, seed: i + 1, d, x: o.x * T, y: o.y * T, baseY: (o.y + (o.h || 1)) * T };
    if (d.light) lights.push({ x: o.x * T + d.light.dx, y: o.y * T + d.light.dy, r: d.light.r, color: d.light.color || '255,214,140' });
    if (o.type === 'wall_window') windows.push({ x: o.x * T + 2, y: o.y * T + 2, w: (o.w || 1) * T - 4, h: 10 });
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
  if (!scene) scene = makeCanvas(ART_W, ART_H);
}

function ensure(world) {
  const season = (world && world.clock && (world.clock.season || seasonOf(world.clock.date))) || 'otono';
  const changed = setSeason(season);
  if (!staticLayer || changed) rebuild();
  if (!lensScene) lensScene = makeCanvas(SW, SH);
}

let walkable = null;
const tileOf = (x, y) => [Math.floor(x / T), Math.floor((y - 1) / T)];

// Anda hacia su sitio por el camino (paths.js), no en línea recta: así no atraviesa paredes ni
// muebles. El camino se calcula al cambiar de destino; si no hay camino, va recto.
function step(c, busy) {
  const tx = c.x * WORLD_TO_ART;
  const ty = c.y * WORLD_TO_ART;
  const p = shown[c.id] || (shown[c.id] = { x: tx, y: ty, moving: false });
  if (p.tx !== tx || p.ty !== ty) {
    p.tx = tx; p.ty = ty;
    if (!walkable) walkable = buildWalkable(officeMap, objectDef);
    const [sx, sy] = tileOf(p.x, p.y);
    const [ex, ey] = tileOf(tx, ty);
    const path = findPath(walkable, sx, sy, ex, ey, busy);
    // Puntos intermedios: el centro de cada casilla (sin la primera ni la última) y el destino exacto.
    p.path = path ? path.slice(1, -1).map(([x, y]) => [x * T + T / 2, y * T + T - 2]) : [];
    p.path.push([tx, ty]);
  }
  const speed = 0.9; // px de arte por frame: andan, no se teletransportan
  let budget = speed;
  while (budget > 0 && p.path && p.path.length) {
    const [wx, wy] = p.path[0];
    const dx = wx - p.x;
    const dy = wy - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= budget) { p.x = wx; p.y = wy; budget -= dist; p.path.shift(); } else {
      p.x += (dx / dist) * budget; p.y += (dy / dist) * budget; budget = 0;
    }
  }
  p.moving = !!(p.path && p.path.length);
  return p;
}

function drawSprite(ctx, item, now, wind) {
  const frames = item.d.frames || 1;
  const frame = frames > 1 ? Math.floor(now / 650 + item.seed) % frames : 0;
  const s = objectSprite(item.o, item.seed, frame);
  if (wind && item.o.type === 'tree') {
    // con viento, la copa se mece: inclinación desde la base del tronco
    const skew = Math.sin(now / 420 + item.seed) * 0.09 * wind;
    const baseY = item.y + s.dy + s.canvas.height;
    ctx.save();
    ctx.translate(item.x + s.dx, baseY);
    ctx.transform(1, 0, skew, 1, 0, 0);
    ctx.drawImage(s.canvas, 0, -s.canvas.height);
    ctx.restore();
    return;
  }
  ctx.drawImage(s.canvas, item.x + s.dx, item.y + s.dy);
}

function minutesOf(clock) {
  const [h, m] = String((clock && clock.hhmm) || '12:00').split(':').map(Number);
  return h * 60 + m;
}

// ¿Está en la oficina? Con el contrato nuevo manda `mode`; sin él, `home`.
export function inOffice(c) {
  if (c.mode) return c.mode === 'oficina' && c.x != null;
  return !c.home && c.x != null;
}

function paintScene(world, animFrame, now) {
  const ctx = scene.ctx;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(staticLayer, 0, 0);
  const clock = world && world.clock;
  const night = !world || clock.block === 'noche';
  const w = clock && clock.weather;
  const env = { w, season: clock && (clock.season || seasonOf(clock.date)), minutes: minutesOf(clock), now };

  // cristales: cielo, nubes, lluvia… de verdad
  for (const win of windows) {
    drawWindowGlass(ctx, win.x, win.y, win.w, win.h, env);
    ctx.fillStyle = '#F0E8D8';
    ctx.fillRect(win.x + Math.floor(win.w / 2), win.y, 1, win.h);
  }

  const wind = isWindy(w) ? Math.min(2, Number(w.wind) / 30) : 0.25;
  const items = dynamicObjects.map(o => ({ y: o.baseY, draw: () => drawSprite(ctx, o, now, wind) }));
  const people = [];
  if (world && !night) {
    // Casillas con gente quieta: el camino las rodea si puede.
    const busy = new Set(Object.values(shown).filter(s => !s.moving).map(s => tileOf(s.x, s.y).join(',')));
    for (const c of world.characters) {
      if (!inOffice(c)) continue;
      const p = step(c, busy);
      people.push({ c, p });
      items.push({
        y: p.y,
        draw: () => {
          renderAvatar(ctx, c.avatar_config || {}, Math.round(p.x - 16), Math.round(p.y - 30), 1,
            animFrame, p.moving ? 'paseando' : c.action, c.representation);
          if (c.visitor) drawVisitorProps(ctx, c.visitor.kind, Math.round(p.x - 16), Math.round(p.y - 30));
        },
      });
    }
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();
  for (const o of overlayObjects) drawSprite(ctx, o, now, 0);

  // la intemperie: tinte del día, nieve acumulada, calor y lo que caiga
  drawOutdoorTint(ctx, OUTDOOR, w, now);
  drawPrecip(ctx, OUTDOOR, weatherKind(w), now, { wind: w ? w.wind : 0 });

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
export function bubble(ctx, text, cx, bottom, { maxW = 190, thought = false } = {}) {
  ctx.font = `${thought ? 'italic ' : ''}600 12px Inter, sans-serif`;
  const lines = wrap(ctx, text, maxW);
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

// Texto corto para el indicador de llamada.
export function callText(c, world) {
  if (!c.call) return null;
  if (c.call.externo) return `📞 ${c.call.externo}`;
  const o = world && world.characters.find(x => x.id === c.call.with);
  return o ? `📞 con ${o.name}` : '📞 en llamada';
}

export function renderOffice(ctx, canvas, world, animFrame, focus) {
  ensure(world);
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

  const focusId = focus && focus.charId;
  // Nombres, llamadas y bocadillos
  for (const { c, p } of people) {
    const [x, y] = S(p.x, p.y);
    const isSel = c.id === focusId;
    pill(ctx, c.name, x, y + 3, {
      font: '700 10px Inter, sans-serif',
      bg: isSel ? 'rgba(242,193,78,0.95)' : 'rgba(30,22,40,0.72)',
      fg: isSel ? '#2A1F2D' : '#FFFFFF',
    });
    const ct = callText(c, world);
    if (ct) pill(ctx, ct, x, y - 33 * scale - 20, { font: '700 10px Inter, sans-serif', bg: 'rgba(46,138,90,0.92)' });
  }
  if (!focus) {
    for (const { c, p } of people) {
      if (!c.bubble) continue;
      const [x, y] = S(p.x, p.y - 31);
      bubble(ctx, c.bubble, x, y - (c.call ? 20 : 0));
    }
  }

  lens = null;
  if (focus && focus.room) drawRoomLens(ctx, w, h, focus, world, people, now, animFrame);
}

// Sala de un personaje según su posición en el mapa.
export function roomIdOf(c) {
  const s = shown[c.id] || { x: c.x * WORLD_TO_ART, y: c.y * WORLD_TO_ART };
  const r = roomAt(officeMap, Math.floor(s.x / T), Math.floor((s.y - 1) / T));
  if (r) return r.id;
  return Math.floor(s.x / T) >= 32 ? 'terraza' : 'pasillo';
}

// La «lupa»: la sala vista de frente, en un círculo, con el resto de la oficina en penumbra.
function drawRoomLens(ctx, w, h, focus, world, people, now, animFrame) {
  const roomId = focus.room;
  const clock = world && world.clock;
  const env = {
    w: clock && clock.weather,
    season: clock && (clock.season || seasonOf(clock.date)),
    minutes: minutesOf(clock),
    now,
    night: !world || (clock && clock.block === 'noche'),
  };
  // Cada uno en un hueco fijo según dónde está en el mapa (de izquierda a derecha), no según a
  // quién se haya pinchado: así nadie cambia de sitio al seleccionar a otro.
  const here = people.filter(x => roomIdOf(x.c) === roomId)
    .sort((a, b) => a.p.x - b.p.x || a.c.id - b.c.id).map(x => x.c);
  const def = sceneDef(roomId);
  const slots = slotsFor(roomId, here.length);
  const placed = here.map((c, i) => ({ c, x: slots[i][0], y: slots[i][1], seated: slots[i][2] === 0 && def.seatsBehind }));

  const lc = lensScene.ctx;
  paintBack(lc, roomId, env);
  const breathe = Math.floor(now / 700) % 2;
  const drawPerson = ({ c, x, y }) => {
    lc.fillStyle = 'rgba(30,15,30,0.25)';
    lc.beginPath(); lc.ellipse(x, y, 8, 2, 0, 0, Math.PI * 2); lc.fill();
    const spr = characterSprite(c.avatar_config || {}, 'idle');
    lc.imageSmoothingEnabled = false;
    const dy = Math.round(y - 30 - (Math.abs(c.id) % 2 ? breathe : 1 - breathe));
    lc.drawImage(spr, Math.round(x - 16), dy);
    if (c.visitor) drawVisitorProps(lc, c.visitor.kind, Math.round(x - 16), dy);
  };
  // fila de atrás → muebles de delante → fila de delante → luz
  const byDepth = (a, b) => a.y - b.y;
  placed.filter(p => p.seated).sort(byDepth).forEach(drawPerson);
  paintFurniture(lc, roomId, env);
  placed.filter(p => !p.seated).sort(byDepth).forEach(drawPerson);
  paintLight(lc, roomId, env);

  const R = Math.round(Math.min(w * 0.4, h * 0.44));
  const cx = Math.round(w / 2);
  const cy = Math.round(h / 2 + Math.min(40, h * 0.06));
  const k = (2 * R) / SH; // px de pantalla por px de arte
  const x0 = cx - (SW * k) / 2;
  const y0 = cy - R;
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,20,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(lensScene.canvas, x0, y0, SW * k, SH * k);
  ctx.restore();
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#2A1F2D';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#F2C14E';
  ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, Math.PI * 2); ctx.stroke();

  // rótulo de la sala abajo del círculo
  pill(ctx, def.label || 'Pasillo', cx, cy + R - 30, { font: '800 12px Inter, sans-serif', bg: 'rgba(30,22,40,0.85)' });

  // nombres, llamadas y bocadillos a resolución de pantalla
  const toScreen = (x, y) => [x0 + x * k, y0 + y * k];
  for (const { c, x, y, seated } of placed) {
    // a los que están sentados tras una mesa, el nombre encima de la cabeza (los pies no se ven)
    const [sx, sy] = seated ? toScreen(x, y - 34) : toScreen(x, y);
    const isSel = c.id === focus.charId;
    pill(ctx, c.name, sx, sy + (seated ? -18 : 2), {
      font: '700 11px Inter, sans-serif',
      bg: isSel ? 'rgba(242,193,78,0.95)' : 'rgba(30,22,40,0.8)',
      fg: isSel ? '#2A1F2D' : '#FFFFFF',
    });
  }
  // de izquierda a derecha, alternando la altura para que los bocadillos no se pisen
  placed.slice().sort((a, b) => a.x - b.x).forEach(({ c, x, y, seated }, i) => {
    const [sx, sy0] = toScreen(x, y - 32);
    const sy = sy0 - (seated ? 22 : 0);
    const ct = callText(c, world);
    const lift = (i % 2) * 40;
    if (ct) pill(ctx, ct, sx, sy - 20, { font: '700 10px Inter, sans-serif', bg: 'rgba(46,138,90,0.92)' });
    if (c.bubble) bubble(ctx, c.bubble, sx, sy - (ct ? 22 : 0) - lift, { maxW: 150 });
  });
  if (!placed.length) {
    pill(ctx, 'Aquí no hay nadie ahora mismo', cx, cy - 10, { font: '700 12px Inter, sans-serif', bg: 'rgba(30,22,40,0.85)' });
  }
  lens = { cx, cy, R, people: placed.map(({ c, x, y }) => ({ id: c.id, ...(() => { const [sx, sy] = toScreen(x, y); return { sx, sy }; })() })), k };
  void animFrame;
}

// Clic con la lupa abierta: dentro del círculo, ¿sobre quién? Fuera, null.
export function pickInLens(sx, sy) {
  if (!lens) return null;
  if (Math.hypot(sx - lens.cx, sy - lens.cy) > lens.R) return { outside: true };
  const hit = lens.people
    .filter(p => Math.abs(sx - p.sx) <= 9 * lens.k && sy <= p.sy + 4 && sy >= p.sy - 32 * lens.k)
    .sort((a, b) => b.sy - a.sy)[0];
  return { charId: hit ? hit.id : null };
}

// Personaje bajo el ratón (coordenadas de pantalla del canvas).
export function pickAt(world, sx, sy) {
  if (!world) return null;
  const ax = (sx - view.ox) / view.scale;
  const ay = (sy - view.oy) / view.scale;
  const hits = world.characters.filter(c => inOffice(c) && shown[c.id]).filter(c => {
    const s = shown[c.id];
    return Math.abs(ax - s.x) <= 10 && ay >= s.y - 30 && ay <= s.y + 6;
  });
  hits.sort((a, b) => shown[b.id].y - shown[a.id].y);
  return hits[0] || null;
}

// Sala bajo el ratón (id) o null si es pared o fuera del mapa.
export function pickRoomAt(sx, sy) {
  const ax = (sx - view.ox) / view.scale;
  const ay = (sy - view.oy) / view.scale;
  const tx = Math.floor(ax / T);
  const ty = Math.floor(ay / T);
  if (tx < 0 || ty < 0 || tx >= officeMap.cols || ty >= officeMap.rows) return null;
  const r = roomAt(officeMap, tx, ty);
  if (r) return r.id;
  return tx >= 32 ? 'terraza' : null;
}

// Nombre de la sala donde está un personaje (para la caja de diálogo).
export function roomLabelOf(c) {
  return sceneDef(roomIdOf(c)).label || 'Pasillo';
}

export function roomLabel(roomId) {
  return sceneDef(roomId).label || 'Pasillo';
}
