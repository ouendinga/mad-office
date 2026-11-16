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
 * ventanas, terraza, árboles con viento. Al hacer clic en una sala se abre la lupa: un zoom de esa
 * sala tal cual está (cualquier plano), o «tu vista», que sigue a tu personaje.
 */

import { getPlan, planVersion } from './plan';
import { buildStatic, objectSprite, objectDef, roomAt, setSeason, T } from '../engine/OfficeArt';
import { renderAvatar } from '../engine/SpriteSheet';
import { drawVisitorProps } from '../engine/VisitorProps';
import { characterSprite } from '../engine/Character';
import { makeCanvas } from '../engine/pixel';
import { buildWalkable, findPath } from './paths';
import { drawStateArt, drawStateSigns, drawBlackout } from './officeState';
import { drawRepresentation } from './avatarSprites';
import { weatherKind, isWindy, drawPrecip, drawOutdoorTint, drawWindowGlass, seasonOf } from './weather';

// Tamaño del arte y zona de la intemperie: dependen del plano (se recalculan si cambia).
export let ART_W = getPlan().cols * T;
export let ART_H = getPlan().rows * T;
const WORLD_TO_ART = 0.5;
// La terraza y el césped (lo que está a la intemperie), en px de arte.
const outdoorOf = p => { const from = p.outdoorFromCol ?? p.cols; return { x: from * T, y: 0, w: (p.cols - from) * T, h: p.rows * T }; };
let OUTDOOR = outdoorOf(getPlan());
let builtFor = planVersion();

let staticLayer = null;
let scene = null;
let dynamicObjects = [];
let overlayObjects = [];
let windows = [];
let lights = [];
let view = { scale: 1, ox: 0, oy: 0 };
let lens = null; // última lupa pintada (para los clics): {cx, cy, R, k, x0, y0, people:[{id, x, y}]}
const shown = {}; // id -> {x, y, moving} en píxeles de arte

function rebuild() {
  staticLayer = buildStatic(getPlan());
  dynamicObjects = [];
  overlayObjects = [];
  windows = [];
  lights = [];
  const sctx = staticLayer.getContext('2d');
  getPlan().objects.forEach((o, i) => {
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
  if (!scene || scene.canvas.width !== ART_W || scene.canvas.height !== ART_H) scene = makeCanvas(ART_W, ART_H);
}

function ensure(world) {
  const season = (world && world.clock && (world.clock.season || seasonOf(world.clock.date))) || 'otono';
  const changed = setSeason(season);
  // Otro plano (la empresa tiene otra oficina, o se ha mudado): todo lo cacheado, fuera.
  if (builtFor !== planVersion()) {
    builtFor = planVersion();
    const p = getPlan();
    ART_W = p.cols * T;
    ART_H = p.rows * T;
    OUTDOOR = outdoorOf(p);
    scene = null;
    walkable = null;
    for (const k of Object.keys(shown)) delete shown[k];
    rebuild();
  } else if (!staticLayer || changed) rebuild();
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
    if (!walkable) walkable = buildWalkable(getPlan(), objectDef);
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
          // Sentado: un poco más abajo, como hundido en la silla.
          const sit = !p.moving && c.action === 'sentado' ? 3 : 0;
          renderAvatar(ctx, c.avatar_config || {}, Math.round(p.x - 16), Math.round(p.y - 30 + sit), 1,
            // Quieto no anda: «paseando» solo mientras se mueve (antes movía los pies parado en la fuente).
            animFrame, p.moving ? 'paseando' : (c.action === 'paseando' || c.action === 'corriendo' ? null : c.action), c.representation);
          if (c.visitor) drawVisitorProps(ctx, c.visitor.kind, Math.round(p.x - 16), Math.round(p.y - 30));
        },
      });
    }
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();
  for (const o of overlayObjects) drawSprite(ctx, o, now, 0);
  // El estado de la oficina: incidentes (charcos, olor, papeles…) y la guirnalda de los eventos.
  drawStateArt(ctx, world && world.office, now);

  // la intemperie: tinte del día, nieve acumulada, calor y lo que caiga
  drawOutdoorTint(ctx, OUTDOOR, w, now);
  drawPrecip(ctx, OUTDOOR, weatherKind(w), now, { wind: w ? w.wind : 0 });
  if (!night) drawBlackout(ctx, world && world.office, now, ART_W, ART_H);

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
  for (const r of getPlan().rooms) {
    if (!r.label || scale < 0.9) continue; // en pantallas pequeñas se pisan
    // Abajo, en el zócalo: arriba tapaba los racks, la nevera, la consola y la cara del jefe.
    const [x, y] = S((r.x + r.w / 2) * T, (r.y + r.h) * T - 6);
    pill(ctx, r.label, x, y, { font: '700 10px Inter, sans-serif', bg: 'rgba(30,22,40,0.62)' });
  }

  // Carteles de incidentes y eventos (en pantalla, para que se lean).
  if (!focus) drawStateSigns(ctx, world && world.office, S, pill);

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
  const r = roomAt(getPlan(), Math.floor(s.x / T), Math.floor((s.y - 1) / T));
  if (r) return r.id;
  const from = getPlan().outdoorFromCol;
  return from != null && from < getPlan().cols && Math.floor(s.x / T) >= from ? 'terraza' : 'pasillo';
}

// La «lupa»: la sala vista de frente, en un círculo, con el resto de la oficina en penumbra.
// La lupa: un zoom de la oficina DE VERDAD (la misma escena del mapa, con cada uno en su sitio),
// en un círculo y con el resto en penumbra. Sirve con cualquier plano. Con `focus.follow` sigue a
// un personaje (tu vista: lo que ve y oye) y oscurece lo que queda fuera de su sala.
function drawRoomLens(ctx, w, h, focus, world, people, now, animFrame) {
  const plan = getPlan();
  const follow = focus.follow && focus.charId != null && shown[focus.charId];
  const roomId = follow && world ? roomIdOf(world.characters.find(c => c.id === focus.charId) || {}) : focus.room;
  const room = plan.rooms.find(r => r.id === roomId);
  // Qué trozo del mapa se ve (en píxeles de arte): la sala con una casilla de margen, o una
  // ventana alrededor de quien se sigue.
  let rx; let ry; let rw; let rh;
  if (follow) {
    const s = shown[focus.charId];
    rw = Math.min(15 * T, ART_W); rh = Math.min(11 * T, ART_H);
    // centrada en él, pero sin salirse del plano
    rx = Math.max(0, Math.min(ART_W - rw, s.x - rw / 2));
    ry = Math.max(0, Math.min(ART_H - rh, s.y - rh / 2 - T));
  } else if (room) {
    rx = (room.x - 1) * T; ry = (room.y - 1) * T; rw = (room.w + 2) * T; rh = (room.h + 2) * T;
  } else {
    rx = 0; ry = 0; rw = ART_W; rh = ART_H;
  }
  const R = Math.round(Math.min(w * 0.42, h * 0.45));
  const cx = Math.round(w / 2);
  const cy = Math.round(h / 2 + Math.min(30, h * 0.04));
  const k = Math.min(6, (2 * R) / Math.max(rw, rh)); // px de pantalla por px de arte
  const x0 = cx - (rx + rw / 2) * k;
  const y0 = cy - (ry + rh / 2) * k;
  const toScreen = (x, y) => [x0 + x * k, y0 + y * k];

  ctx.save();
  ctx.fillStyle = 'rgba(10,8,20,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#1B1626';
  ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scene.canvas, x0, y0, ART_W * k, ART_H * k);
  // Siguiendo a alguien: lo de fuera de su sala, en penumbra (no lo oye).
  if (follow && room) {
    const [ax, ay] = toScreen(room.x * T, room.y * T);
    const [bx, by] = toScreen((room.x + room.w) * T, (room.y + room.h) * T);
    ctx.fillStyle = 'rgba(10,8,20,0.5)';
    ctx.fillRect(cx - R, cy - R, 2 * R, ay - (cy - R));
    ctx.fillRect(cx - R, by, 2 * R, cy + R - by);
    ctx.fillRect(cx - R, ay, ax - (cx - R), by - ay);
    ctx.fillRect(bx, ay, cx + R - bx, by - ay);
  }
  // Quien está dentro de lo que se ve: nombres, llamadas y bocadillos a resolución de pantalla.
  const inView = people.filter(({ p }) => p.x >= rx && p.x <= rx + rw && p.y >= ry && p.y <= ry + rh + 8)
    .filter(({ c }) => !follow || !room || roomIdOf(c) === roomId);
  for (const { c, p } of inView) {
    const [sx, sy] = toScreen(p.x, p.y);
    const isSel = c.id === focus.charId;
    pill(ctx, c.name, sx, sy + 4, {
      font: '700 11px Inter, sans-serif',
      bg: isSel ? 'rgba(242,193,78,0.95)' : 'rgba(30,22,40,0.8)',
      fg: isSel ? '#2A1F2D' : '#FFFFFF',
    });
  }
  inView.slice().sort((a, b) => a.p.x - b.p.x).forEach(({ c, p }, i) => {
    const [sx, sy] = toScreen(p.x, p.y - 32);
    const ct = callText(c, world);
    if (ct) pill(ctx, ct, sx, sy - 18, { font: '700 10px Inter, sans-serif', bg: 'rgba(46,138,90,0.92)' });
    if (c.bubble) bubble(ctx, c.bubble, sx, sy - (ct ? 20 : 0) - (i % 2) * 34, { maxW: 160 });
  });
  ctx.restore();
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#2A1F2D';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#F2C14E';
  ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, Math.PI * 2); ctx.stroke();

  const label = follow ? `Tu vista · ${(room && room.label) || 'Pasillo'}` : (room && room.label) || 'Pasillo';
  pill(ctx, label, cx, cy + R - 26, { font: '800 12px Inter, sans-serif', bg: 'rgba(30,22,40,0.85)' });
  if (!inView.length) pill(ctx, 'Aquí no hay nadie ahora mismo', cx, cy - 10, { font: '700 12px Inter, sans-serif', bg: 'rgba(30,22,40,0.85)' });
  lens = { cx, cy, R, k, people: inView.map(({ c, p }) => { const [sx, sy] = toScreen(p.x, p.y); return { id: c.id, sx, sy }; }) };
  void animFrame; void now;
}

// Clic con la lupa abierta: dentro del círculo, ¿sobre quién? Fuera, null.
export function pickInLens(sx, sy) {
  if (!lens) return null;
  if (Math.hypot(sx - lens.cx, sy - lens.cy) > lens.R) return { outside: true };
  const hit = lens.people
    .filter(p => Math.abs(sx - p.sx) <= 10 * lens.k && sy <= p.sy + 6 * lens.k && sy >= p.sy - 32 * lens.k)
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
  if (tx < 0 || ty < 0 || tx >= getPlan().cols || ty >= getPlan().rows) return null;
  const r = roomAt(getPlan(), tx, ty);
  if (r) return r.id;
  const from = getPlan().outdoorFromCol;
  return from != null && tx >= from ? 'terraza' : null;
}

// Nombre de la sala donde está un personaje (para la caja de diálogo).
export function roomLabelOf(c) {
  return roomLabel(roomIdOf(c));
}

export function roomLabel(roomId) {
  const r = getPlan().rooms.find(x => x.id === roomId);
  return (r && r.label) || 'Pasillo';
}
