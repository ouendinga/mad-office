/**
 * La calle: lo que se ve la media hora antes de entrar (ida) y después de salir (vuelta). Fachadas, acera,
 * paso de cebra, parada del bus y farolas, con el cielo de la hora, la estación y el tiempo.
 * Los que van (mode 'ida') andan hacia la puerta de la oficina; los que vuelven, se alejan.
 * Si su trayecto habla de bus o metro, esperan un rato en la parada.
 */

import { makeCanvas, brush, shade, hash } from '../engine/pixel';
import { characterSprite } from '../engine/Character';
import { weatherKind, skyColors, drawPrecip, drawOutdoorTint, seasonOf } from './weather';
import { bubble } from './officeRenderer';

const W = 256;
const H = 120;
const SIDEWALK = 84; // y de la acera
const ROAD = 100;
const DOOR_X = 214;
const STOP_X = 70;

let layer = null;
const shown = {}; // id -> {x}

function minutesOf(clock) {
  const [h, m] = String((clock && clock.hhmm) || '08:45').split(':').map(Number);
  return h * 60 + m;
}

function paintSky(b, ctx, env) {
  const kind = weatherKind(env.w);
  const sky = skyColors(env.minutes, env.season, kind);
  const g = ctx.createLinearGradient(0, 0, 0, SIDEWALK);
  g.addColorStop(0, sky.top); g.addColorStop(1, sky.bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, SIDEWALK);
  if (sky.grey) { ctx.fillStyle = `rgba(140,148,165,${sky.grey * 0.7})`; ctx.fillRect(0, 0, W, SIDEWALK); }
  if (sky.dark) for (let i = 0; i < 40; i++) b.p(Math.floor(hash(i, 1, 21) * W), Math.floor(hash(i, 2, 21) * 30), '#FFFFFF');
  else if (['clear', 'partly'].includes(kind)) { b.r(28, 10, 10, 10, '#FFF1A8'); b.r(26, 12, 14, 6, '#FFF1A8'); b.r(30, 8, 6, 14, '#FFF1A8'); }
  return sky;
}

function building(b, x, w, h, color, sky, seed) {
  const top = SIDEWALK - h;
  b.r(x, top, w, h, color);
  b.r(x, top, w, 2, shade(color, 25));
  b.r(x + w - 2, top, 2, h, shade(color, -25));
  for (let yy = top + 6; yy < SIDEWALK - 10; yy += 10) {
    for (let xx = x + 4; xx < x + w - 8; xx += 9) {
      const lit = sky.dark ? hash(xx, yy, seed) > 0.45 : false;
      b.r(xx, yy, 6, 6, lit ? '#FFD98A' : (sky.dark ? '#2A2D4A' : '#9FC7E6'));
      b.r(xx, yy + 6, 6, 1, shade(color, -30));
      if (!sky.dark) b.p(xx + 1, yy + 1, '#D8ECF8');
    }
  }
}

function tree(b, x, season, wind, now, seed) {
  b.r(x + 4, SIDEWALK - 18, 3, 18, '#7A4B2C');
  b.r(x, SIDEWALK - 1, 11, 2, '#6B4A30');
  if (season === 'invierno') {
    for (let i = 0; i < 5; i++) { const k = i % 2 ? 1 : -1; for (let s = 1; s < 5; s++) b.p(x + 5 + k * s, SIDEWALK - 18 - i * 2 - Math.floor(s / 2), '#6B4630'); }
    return;
  }
  const pal = { primavera: ['#3B8A3F', '#55AE4F', '#F7B6D2'], verano: ['#1F6A30', '#2F8A3A', '#4FB04A'], otono: ['#A4471E', '#D9822B', '#F0B342'] }[season];
  const sway = Math.round(Math.sin(now / 500 + seed) * wind);
  for (let yy = -12; yy <= 0; yy++) for (let xx = -9; xx <= 9; xx++) {
    if (xx * xx / 81 + yy * yy / 50 > 1 + hash(xx, yy, seed) * 0.3) continue;
    b.p(x + 5 + xx + (yy < -6 ? sway : 0), SIDEWALK - 26 + yy, pal[(hash(xx, yy, seed + 1) * 3) | 0]);
  }
}

function lamp(b, ctx, x, lit) {
  b.r(x, SIDEWALK - 34, 2, 34, '#3B3F52');
  b.r(x - 4, SIDEWALK - 36, 10, 3, '#3B3F52');
  b.r(x - 3, SIDEWALK - 33, 8, 2, lit ? '#FFE9A8' : '#9AA1AD');
  if (lit) {
    const g = ctx.createRadialGradient(x + 1, SIDEWALK - 30, 0, x + 1, SIDEWALK - 30, 30);
    g.addColorStop(0, 'rgba(255,220,150,0.45)'); g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g; ctx.fillRect(x - 30, SIDEWALK - 60, 62, 70);
    ctx.globalCompositeOperation = 'source-over';
  }
}

function paintStreet(ctx, env, now) {
  const b = brush(ctx);
  const sky = paintSky(b, ctx, env);
  // fachadas: pisos a la izquierda, la oficina a la derecha
  building(b, -4, 46, 62, '#C98A6A', sky, 1);
  building(b, 42, 40, 52, '#E2C9A0', sky, 2);
  building(b, 82, 50, 68, '#9AA9C4', sky, 3);
  building(b, 132, 40, 48, '#D6A3A3', sky, 4);
  // Mad Office
  b.r(176, SIDEWALK - 70, 80, 70, '#4B4F66'); b.r(176, SIDEWALK - 70, 80, 3, '#6A6F8C');
  for (let yy = SIDEWALK - 62; yy < SIDEWALK - 22; yy += 12) for (let xx = 182; xx < 250; xx += 14) b.r(xx, yy, 10, 8, sky.dark ? '#FFD98A' : '#8FD3F5');
  b.r(190, SIDEWALK - 20, 50, 8, '#2B2F3D'); b.r(193, SIDEWALK - 18, 8, 4, '#F2C14E');
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 6px monospace'; ctx.fillText('MAD OFFICE', 204, SIDEWALK - 14);
  b.r(DOOR_X - 8, SIDEWALK - 12, 16, 12, '#2F8C86'); b.r(DOOR_X - 7, SIDEWALK - 11, 6, 11, '#8FD3F5'); b.r(DOOR_X + 1, SIDEWALK - 11, 6, 11, '#8FD3F5');
  // acera y bordillo
  for (let y = SIDEWALK; y < ROAD; y++) for (let x = 0; x < W; x++) b.p(x, y, (x % 10 === 0 || (y - SIDEWALK) % 6 === 0) ? '#A8A49C' : '#C9C4BA');
  b.r(0, ROAD - 2, W, 2, '#8D8A82');
  // calzada con paso de cebra
  b.r(0, ROAD, W, H - ROAD, '#4A4D57');
  for (let x = 0; x < W; x += 20) b.r(x, ROAD + 9, 10, 1, '#D9D4C5');
  for (let x = 140; x < 168; x += 5) b.r(x, ROAD + 1, 3, H - ROAD - 2, '#ECE8DE');
  // parada del bus
  b.r(STOP_X - 18, SIDEWALK - 26, 36, 2, '#3B3F52'); b.r(STOP_X - 18, SIDEWALK - 24, 2, 24, '#3B3F52'); b.r(STOP_X + 16, SIDEWALK - 24, 2, 24, '#3B3F52');
  ctx.fillStyle = 'rgba(190,225,245,0.35)'; ctx.fillRect(STOP_X - 16, SIDEWALK - 24, 32, 22);
  b.r(STOP_X - 12, SIDEWALK - 8, 24, 2, '#7A4B2C');
  b.r(STOP_X + 20, SIDEWALK - 30, 2, 30, '#3B3F52'); b.r(STOP_X + 17, SIDEWALK - 36, 8, 7, '#E3584B'); b.r(STOP_X + 19, SIDEWALK - 34, 4, 3, '#FFFFFF');
  const wind = env.w && Number(env.w.wind) >= 28 ? 2 : 0;
  tree(b, 30, env.season, wind, now, 1);
  tree(b, 118, env.season, wind, now, 2);
  tree(b, 166, env.season, wind, now, 3);
  for (const x of [8, 100, 150, 248]) lamp(b, ctx, x, sky.dark);
  return sky;
}

export function renderStreet(ctx, canvas, world, animFrame) {
  if (!layer) layer = makeCanvas(W, H);
  const now = performance.now();
  const clock = (world && world.clock) || {};
  const env = { w: clock.weather, season: clock.season || seasonOf(clock.date), minutes: minutesOf(clock), now, clock };
  const l = layer.ctx;
  l.imageSmoothingEnabled = false;
  const sky = paintStreet(l, env, now);

  const phase = clock.phase;
  const walkers = ((world && world.characters) || []).filter(c => c.mode === 'ida' || c.mode === 'vuelta');
  // La franja la manda el servidor según el horario configurado; si no, la de 9 a 18.
  const win = (env.clock && env.clock.commute) || (phase === 'vuelta' ? { from: 1080, to: 1110 } : { from: 510, to: 540 });
  const t = (env.minutes - win.from) / Math.max(1, win.to - win.from);
  // En fila: cada uno a su distancia del anterior. Al llegar a la puerta, entra (desaparece);
  // al volver, se pierde por la izquierda.
  const placed = [];
  walkers.forEach((c, i) => {
    const p = Math.max(0, Math.min(1.2, t * 1.15));
    const byBus = /bus|autob|metro|parada/i.test(c.trayecto || '');
    const gap = 26 + hash(c.id, 3, 7) * 14;
    let tx;
    if (c.mode === 'ida') {
      tx = -20 + p * (DOOR_X + 20) - i * gap;
      if (byBus && tx > STOP_X - 14 && tx < STOP_X + 40 && p < 0.7) tx = STOP_X - 10 + (i % 3) * 8;
      if (tx >= DOOR_X - 2) return; // ya ha entrado
    } else {
      tx = DOOR_X - p * (DOOR_X + 30) + i * gap;
      if (byBus && tx < STOP_X + 14 && tx > STOP_X - 40 && p < 0.9) tx = STOP_X - 10 + (i % 3) * 8;
      if (tx > DOOR_X) tx = DOOR_X; // aún sale por la puerta
      if (tx < -18) return; // ya se ha ido
    }
    const s = shown[c.id] || (shown[c.id] = { x: tx });
    const moving = Math.abs(tx - s.x) > 0.3;
    s.x += Math.max(-0.6, Math.min(0.6, tx - s.x));
    placed.push({ c, x: s.x, y: SIDEWALK + 10 + (i % 3) * 3, moving });
  });
  placed.sort((a, b) => a.y - b.y).forEach(({ c, x, y, moving }) => {
    l.fillStyle = 'rgba(30,15,30,0.25)';
    l.beginPath(); l.ellipse(x, y, 7, 2, 0, 0, Math.PI * 2); l.fill();
    const pose = moving ? (animFrame % 2 ? 'walk1' : 'walk2') : 'idle';
    l.drawImage(characterSprite(c.avatar_config || {}, pose), Math.round(x - 16), Math.round(y - 30));
    // paraguas si llueve
    if (['rain', 'heavyrain', 'storm'].includes(weatherKind(env.w))) {
      const col = ['#E3584B', '#4E7FB8', '#F2C14E', '#3FAE5A'][c.id % 4];
      l.fillStyle = col; l.fillRect(Math.round(x - 11), Math.round(y - 38), 22, 3); l.fillRect(Math.round(x - 8), Math.round(y - 40), 16, 2);
      l.fillStyle = '#3B3F52'; l.fillRect(Math.round(x), Math.round(y - 36), 1, 10);
    }
  });
  drawOutdoorTint(l, { x: 0, y: 0, w: W, h: H }, env.w, now);
  drawPrecip(l, { x: 0, y: 0, w: W, h: H }, weatherKind(env.w), now, { wind: env.w ? env.w.wind : 0 });

  // a pantalla
  const cw = canvas.width;
  const ch = canvas.height;
  const scale = Math.min(cw / W, ch / H);
  const ox = Math.floor((cw - W * scale) / 2);
  const oy = Math.floor(ch - H * scale); // apoyada abajo: arriba sigue el cielo
  ctx.fillStyle = '#4A4D57';
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = sky.top;
  ctx.fillRect(0, 0, cw, oy + 2);
  if (sky.grey) { ctx.fillStyle = `rgba(140,148,165,${sky.grey * 0.7})`; ctx.fillRect(0, 0, cw, oy + 2); }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(layer.canvas, ox, oy, W * scale, H * scale);

  // nombres y bocadillos con lo que les pasa por el camino (alternando alturas)
  placed.forEach(({ c, x, y }, i) => {
    const sx = ox + x * scale;
    const sy = oy + y * scale;
    ctx.font = '700 11px Inter, sans-serif';
    const tw = ctx.measureText(c.name).width + 12;
    ctx.fillStyle = 'rgba(30,22,40,0.78)';
    ctx.fillRect(Math.round(sx - tw / 2), Math.round(sy + 4), tw, 17);
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.fillText(c.name, Math.round(sx), Math.round(sy + 16));
    if (c.trayecto) bubble(ctx, c.trayecto, sx, sy - 32 * scale - (i % 3) * 46, { maxW: 150 });
  });
  if (!placed.length) {
    ctx.font = '700 14px Inter, sans-serif'; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
    ctx.fillText(phase === 'vuelta' ? 'Ya se han ido todos' : 'Aún no ha salido nadie de casa', cw / 2, oy + 30);
  }
  ctx.textAlign = 'left';
}

export function streetHasWalkers(world) {
  return !!world && world.characters.some(c => c.mode === 'ida' || c.mode === 'vuelta');
}
