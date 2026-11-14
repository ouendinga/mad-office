/**
 * Las salas vistas de frente (la «lupa» grande): pared del fondo con su decoración, suelo y
 * muebles, dibujados por código a resolución de arte (SW×SH) y escalados sin suavizar.
 * Se pintan en dos capas para que los muebles de delante tapen las piernas de quien está
 * detrás: paintBack() (pared, suelo, muebles del fondo) y paintFront() (lo de delante).
 *
 * Cada sala define también dónde se colocan los personajes (filas de atrás y de delante).
 */

import { makeCanvas, brush, shade, hash, outline } from './pixel';
import { drawWindowGlass, drawPrecip, drawOutdoorTint, weatherKind, skyColors } from '../canvas/weather';

export const SW = 176;
export const SH = 150;
const OUT = '#2A1F2D';
const WALL_H = 64; // la pared ocupa de 0 a WALL_H; luego el suelo

// --- sprites de muebles con contorno (cacheados) ---

const spriteCache = new Map();
function spr(key, w, h, fn) {
  if (spriteCache.has(key)) return spriteCache.get(key);
  const { canvas, ctx } = makeCanvas(w + 2, h + 2);
  ctx.translate(1, 1);
  fn(brush(ctx), ctx);
  outline(canvas, OUT);
  spriteCache.set(key, canvas);
  return canvas;
}
const put = (ctx, c, x, y) => ctx.drawImage(c, Math.round(x) - 1, Math.round(y) - 1);

// --- suelos y paredes ---

function paintWall(ctx, color) {
  const b = brush(ctx);
  b.r(0, 0, SW, WALL_H, color);
  for (let y = 0; y < WALL_H; y += 2) for (let x = 0; x < SW; x += 1) if (hash(x, y, 31) > 0.93) b.p(x, y, shade(color, -8));
  b.r(0, WALL_H - 5, SW, 4, shade(color, -40)); // rodapié
  b.r(0, WALL_H - 5, SW, 1, shade(color, -22));
  b.r(0, 0, SW, 3, shade(color, -25)); // techo
}

function paintFloor(ctx, type) {
  const b = brush(ctx);
  const H = SH - WALL_H;
  for (let y = WALL_H; y < SH; y++) {
    const row = y - WALL_H;
    for (let x = 0; x < SW; x++) {
      let c;
      if (type === 'carpet') {
        c = ((x >> 2) + (y >> 2)) % 2 ? '#5A6886' : '#56637F';
        if (hash(x, y, 1) > 0.95) c = '#4D5873';
      } else if (type === 'tiles') {
        const cell = 10 + Math.floor(row / 12) * 2;
        c = (Math.floor(x / cell) + Math.floor(row / 8)) % 2 ? '#F4F1EA' : '#7FA7C9';
      } else if (type === 'bath') {
        c = (x % 8 === 0 || row % 8 === 0) ? '#A9C9CF' : '#DCEFF2';
      } else if (type === 'marble') {
        c = '#EDE8DF';
        if (hash(Math.floor(x / 3), Math.floor(y / 2), 2) > 0.92) c = '#D5CEC2';
        if (x % 24 === 0 || row % 14 === 0) c = '#D9D2C5';
      } else if (type === 'server') {
        c = (x % 12 === 0 || row % 10 === 0) ? '#3E465B' : '#56607A';
        if ((x % 12 === 6) && (row % 10 === 5)) c = '#454E66';
      } else if (type === 'parquet') {
        const k = (Math.floor(x / 6) + Math.floor(row / 6)) % 2;
        c = k ? '#9C6A45' : '#B07B52';
        if ((k ? x % 6 : row % 6) === 0) c = '#7E5333';
      } else if (type === 'deck') {
        const plank = Math.floor(row / 5);
        c = shade('#B87F4D', Math.floor(hash(plank, Math.floor(x / 40), 3) * 18) - 9);
        if (row % 5 === 4) c = '#7A5434';
        if ((x + plank * 17) % 40 === 0) c = '#8A5E3C';
      } else { // wood
        const plank = Math.floor(row / 5);
        c = shade('#C79A68', Math.floor(hash(plank, Math.floor((x + plank * 13) / 30), 4) * 16) - 8);
        if (row % 5 === 4) c = '#9C6E44';
        if ((x + plank * 13) % 30 === 0) c = '#A87A4F';
      }
      b.p(x, y, c);
    }
  }
  // sombra de la pared sobre el suelo y algo de profundidad (más oscuro al fondo)
  const g = ctx.createLinearGradient(0, WALL_H, 0, WALL_H + 14);
  g.addColorStop(0, 'rgba(30,20,40,0.28)');
  g.addColorStop(1, 'rgba(30,20,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, WALL_H, SW, 14);
  void H;
}

// Ventana en la pared con el tiempo de verdad detrás.
function windowOn(ctx, x, y, w, h, env) {
  const b = brush(ctx);
  b.r(x - 2, y - 2, w + 4, h + 4, '#F0E8D8');
  b.r(x - 2, y + h + 2, w + 4, 2, shade('#F0E8D8', -40));
  drawWindowGlass(ctx, x, y, w, h, env);
  b.r(x + Math.floor(w / 2), y, 1, h, '#F0E8D8');
  b.r(x, y + Math.floor(h / 2), w, 1, '#F0E8D8');
  ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
}

// --- piezas reutilizables ---

const plant = (big = false) => spr(`plant${big}`, big ? 16 : 12, big ? 26 : 18, (b) => {
  const w = big ? 16 : 12; const h = big ? 26 : 18;
  b.r(3, h - 8, w - 6, 8, '#C66B3D'); b.r(3, h - 8, w - 6, 2, '#E08A57');
  for (let i = 0; i < (big ? 40 : 22); i++) {
    const x = Math.floor(hash(i, w, 1) * w); const y = Math.floor(hash(i, h, 2) * (h - 8));
    b.r(x, y, 2, 3, ['#2F7D3A', '#3F9C45', '#62C055'][i % 3]);
  }
});

const monitorBack = spr('monback', 18, 14, (b) => {
  b.r(0, 0, 18, 11, '#B9C0CD'); b.r(1, 1, 16, 9, '#D3D9E3'); b.r(1, 1, 16, 1, '#EEF1F6');
  b.r(7, 11, 4, 2, '#8D97A8'); b.r(5, 13, 8, 1, '#8D97A8');
});

function deskFront(w) {
  return spr(`deskfront${w}`, w, 18, (b) => {
    b.r(0, 0, w, 4, '#DBA673'); b.r(0, 0, w, 1, '#EBC08E');
    b.r(0, 4, w, 12, '#C28A55'); b.r(0, 4, w, 1, '#946236');
    b.r(4, 8, w - 8, 1, '#A8723F'); b.r(w / 2 - 2, 9, 4, 2, '#946236');
    b.r(1, 16, 3, 2, '#3B3F52'); b.r(w - 4, 16, 3, 2, '#3B3F52');
  });
}

function tableFront(w, color = '#8A5A3A') {
  return spr(`table${w}${color}`, w, 16, (b) => {
    b.r(0, 0, w, 5, shade(color, 30)); b.r(0, 0, w, 1, shade(color, 50));
    b.r(0, 5, w, 5, color); b.r(0, 10, w, 1, shade(color, -40));
    b.r(3, 11, 3, 5, shade(color, -50)); b.r(w - 6, 11, 3, 5, shade(color, -50));
  });
}

const chairBack = spr('chairback', 14, 14, (b) => {
  b.r(1, 0, 12, 9, '#3B4256'); b.r(2, 1, 10, 7, '#4C556E'); b.r(6, 9, 2, 3, '#2E3342'); b.r(2, 12, 10, 2, '#2E3342');
});

function whiteboard(w, h, seed) {
  return spr(`wb${w}${h}${seed}`, w, h, (b) => {
    b.r(0, 0, w, h, '#C9CED8'); b.r(2, 2, w - 4, h - 4, '#FBFBF8');
    const cols = ['#E3584B', '#2F6FB0', '#3FAE5A'];
    for (let i = 0; i < 5; i++) {
      const y = 5 + i * 4; const len = 8 + Math.floor(hash(i, seed, 1) * (w - 20));
      b.r(5, y, len, 1, cols[i % 3]);
    }
    b.r(w - 16, 6, 8, 8, '#FFE066'); b.r(w - 14, 16, 8, 6, '#F7A8C8');
    b.r(2, h - 3, w - 4, 2, '#9AA1AD');
  });
}

function kanban(w, h) {
  return spr(`kanban${w}${h}`, w, h, (b) => {
    b.r(0, 0, w, h, '#F7F7F2'); b.r(0, 0, w, 3, '#5A6886');
    const n = ['#FFE066', '#7FD1AE', '#F7A8C8', '#8EC5FF'];
    const cols = 3; const cw = Math.floor((w - 4) / cols);
    for (let c = 0; c < cols; c++) {
      b.r(2 + c * cw + cw - 1, 4, 1, h - 6, '#DADAD3');
      for (let i = 0; i < 4 - c; i++) b.r(4 + c * cw, 6 + i * 6, cw - 6, 4, n[(i + c) % 4]);
    }
  });
}

function wallScreen(w, h, kind = 'chart') {
  return (ctx, x, y, now) => {
    const b = brush(ctx);
    b.r(x, y, w, h, '#1E2230'); b.r(x + 2, y + 2, w - 4, h - 4, kind === 'tv' ? '#4D3C8F' : '#2F6FB0');
    if (kind === 'chart') {
      for (let i = 0; i < 6; i++) {
        const bh = 3 + Math.floor((Math.sin(now / 1500 + i) * 0.5 + 0.5) * (h - 12));
        b.r(x + 5 + i * 5, y + h - 4 - bh, 3, bh, ['#F2C14E', '#7FD1AE', '#E85D75'][i % 3]);
      }
      b.r(x + w - 18, y + 5, 12, 2, '#FFFFFF'); b.r(x + w - 18, y + 9, 9, 1, '#BFD8F2');
    } else if (kind === 'tv') {
      const t = Math.floor(now / 2000) % 3;
      b.r(x + 6, y + 5, w - 12, h - 10, ['#F7A8C8', '#8EC5FF', '#B6F28E'][t]);
      b.r(x + 10, y + 8, 8, 4, '#FFFFFF');
    } else if (kind === 'slides') {
      b.r(x + 4, y + 4, w - 8, h - 8, '#F6F2EA');
      b.r(x + 7, y + 7, w - 20, 2, '#2B2F3D'); b.r(x + 7, y + 12, w - 26, 1, '#9AA3B5'); b.r(x + 7, y + 15, w - 30, 1, '#9AA3B5');
      b.r(x + w - 14, y + 7, 7, 9, '#E3884B');
    }
    ctx.strokeStyle = OUT; ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
  };
}

function frame(ctx, x, y, w, h, color) {
  const b = brush(ctx);
  b.r(x, y, w, h, '#7A4B2C'); b.r(x + 1, y + 1, w - 2, h - 2, '#F6F2EA');
  b.r(x + 2, y + 2, w - 4, h - 4, shade(color, 40)); b.r(x + 2, y + Math.floor(h / 2), w - 4, h - Math.floor(h / 2) - 2, color);
  ctx.strokeStyle = OUT; ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
}

const RACK_W = 18;
function rack(ctx, x, y, h, now, seed) {
  const b = brush(ctx);
  b.r(x, y, RACK_W, h, '#262A36'); b.r(x + 1, y + 1, RACK_W - 2, h - 2, '#323848');
  for (let i = 0; i < Math.floor((h - 4) / 4); i++) {
    const yy = y + 3 + i * 4;
    b.r(x + 2, yy, RACK_W - 4, 3, '#3E4558');
    const on = hash(i, seed, Math.floor(now / 350) % 7) > 0.45;
    b.p(x + 3, yy + 1, on ? '#5BF08A' : '#1F5A33');
    b.p(x + 5, yy + 1, hash(i, seed, 2) > 0.7 ? (on ? '#FFB347' : '#5A3A16') : '#1F5A33');
    b.r(x + 8, yy + 1, 7, 1, '#2A2F3D');
  }
  ctx.strokeStyle = OUT; ctx.strokeRect(x - 0.5, y - 0.5, RACK_W + 1, h + 1);
}

// --- cielo y exterior (terraza) ---

function paintOutdoor(ctx, env) {
  const kind = weatherKind(env.w);
  const sky = skyColors(env.minutes, env.season, kind);
  const g = ctx.createLinearGradient(0, 0, 0, WALL_H + 10);
  g.addColorStop(0, sky.top); g.addColorStop(1, sky.bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, WALL_H + 10);
  if (sky.grey) { ctx.fillStyle = `rgba(140,148,165,${sky.grey * 0.7})`; ctx.fillRect(0, 0, SW, WALL_H + 10); }
  const b = brush(ctx);
  if (!sky.dark && ['clear', 'partly'].includes(kind)) {
    b.r(SW - 30, 8, 8, 8, '#FFF1A8'); b.r(SW - 29, 7, 6, 10, '#FFF1A8'); b.r(SW - 31, 9, 10, 6, '#FFF1A8');
  }
  if (sky.dark) for (let i = 0; i < 30; i++) b.p(Math.floor(hash(i, 1, 9) * SW), Math.floor(hash(i, 2, 9) * 30), '#FFFFFF');
  if (['partly', 'cloudy', 'rain', 'heavyrain', 'storm', 'snow'].includes(kind)) {
    const n = kind === 'partly' ? 3 : 6;
    for (let i = 0; i < n; i++) {
      const cx = ((hash(i, 3) * SW + env.now / (60 + i * 10)) % (SW + 40)) - 20;
      const cy = 6 + hash(i, 4) * 18;
      const col = ['rain', 'heavyrain', 'storm'].includes(kind) ? '#9AA2B0' : '#F4F6FA';
      b.r(cx, cy, 22, 5, col); b.r(cx + 4, cy - 3, 12, 4, col); b.r(cx + 2, cy + 5, 18, 1, shade(col, -25));
    }
  }
  // ciudad al fondo
  for (let i = 0; i < 12; i++) {
    const w = 10 + Math.floor(hash(i, 5) * 10); const h = 14 + Math.floor(hash(i, 6) * 26);
    const x = i * 15 - 4;
    const col = sky.dark ? '#262A48' : shade('#8C96B4', -Math.floor(hash(i, 7) * 30));
    b.r(x, WALL_H + 2 - h, w, h, col);
    for (let yy = WALL_H - h + 5; yy < WALL_H - 2; yy += 4) for (let xx = x + 2; xx < x + w - 2; xx += 3) {
      if (hash(xx, yy, 8) > (sky.dark ? 0.55 : 0.8)) b.p(xx, yy, sky.dark ? '#FFD98A' : '#C9D6EA');
    }
  }
  if (env.season === 'invierno' && kind === 'snow') b.r(0, WALL_H, SW, 2, '#FFFFFF');
}

// --- definición de cada sala ---
// back(ctx, env) pinta pared/suelo/muebles del fondo; front(ctx, env) lo de delante.
// slots: [x, yPies, fila] donde se colocan los personajes (fila 0 = detrás de los muebles).

const ROOMS = {
  openspace: {
    label: 'Open space', floor: 'carpet', wall: '#E9DFCC',
    back(ctx, env) {
      windowOn(ctx, 10, 12, 30, 24, env); windowOn(ctx, SW - 40, 12, 30, 24, env);
      put(ctx, kanban(40, 30), 68, 14);
      wallScreen(26, 18, 'chart')(ctx, 112, 18, env.now);
      put(ctx, plant(true), 2, WALL_H - 18);
    },
    seatsBehind: true,
    front(ctx) {
      for (const x of [16, 66, 116]) { put(ctx, monitorBack, x + 27, 92); put(ctx, deskFront(46), x, 104); }
      put(ctx, plant(false), SW - 14, 128);
    },
    slots: [[31, 110, 0], [81, 110, 0], [131, 110, 0], [56, 142, 1], [108, 142, 1], [156, 142, 1], [20, 142, 1]],
  },
  pasillo: {
    label: 'Pasillo', floor: 'wood', wall: '#E9DFCC',
    back(ctx) {
      frame(ctx, 20, 14, 18, 22, '#4E7FB8'); frame(ctx, 50, 18, 14, 16, '#E3884B');
      const b = brush(ctx);
      b.r(90, 8, 26, WALL_H - 13, '#A87A4F'); b.r(92, 10, 22, WALL_H - 17, '#C79A68'); b.r(110, 34, 2, 3, '#F2C14E'); // puerta
      put(ctx, spr('cooler', 12, 30, (bb) => { bb.r(1, 0, 10, 10, '#8EC5FF'); bb.r(2, 1, 8, 3, '#BDE8FB'); bb.r(0, 10, 12, 20, '#E8ECF2'); bb.r(4, 14, 4, 2, '#3B4256'); }), 136, WALL_H - 30);
      put(ctx, plant(true), SW - 18, WALL_H - 18);
    },
    slots: [[54, 120, 1], [86, 132, 1], [118, 122, 1], [70, 144, 1], [140, 140, 1]],
  },
  reuniones: {
    label: 'Sala de reuniones', floor: 'wood', wall: '#DDE6EC',
    back(ctx, env) {
      put(ctx, whiteboard(44, 30, 3), 10, 12);
      wallScreen(46, 28, 'slides')(ctx, 66, 10, env.now);
      windowOn(ctx, 128, 12, 34, 26, env);
      for (const x of [26, 52, 78, 104, 130]) put(ctx, chairBack, x, 84);
    },
    seatsBehind: true,
    front(ctx) { put(ctx, tableFront(150, '#7A4E32'), 13, 98); },
    slots: [[33, 104, 0], [59, 104, 0], [85, 104, 0], [111, 104, 0], [137, 104, 0], [60, 142, 1], [116, 142, 1]],
  },
  cocina: {
    label: 'Cocina', floor: 'tiles', wall: '#F2E6C9',
    back(ctx, env) {
      const b = brush(ctx);
      // armarios altos y encimera
      for (let x = 6; x < 110; x += 26) { b.r(x, 8, 24, 18, '#FFFFFF'); b.r(x + 1, 9, 22, 16, '#EDE7DA'); b.r(x + 10, 20, 4, 1, '#9AA1AD'); }
      b.r(4, 40, 112, 6, '#6B7A8F'); b.r(4, 46, 112, 14, '#EFE9DE'); b.r(4, 40, 112, 1, '#8D9AAE');
      // cafetera con humo
      b.r(14, 30, 12, 10, '#2B2F3D'); b.r(16, 32, 8, 4, '#E3584B'); b.r(18, 37, 4, 3, '#FFFFFF');
      if (Math.floor(env.now / 400) % 2) { b.p(19, 27, '#DDDDDD'); b.p(20, 25, '#EEEEEE'); } else { b.p(21, 27, '#DDDDDD'); b.p(20, 24, '#EEEEEE'); }
      b.r(40, 34, 14, 6, '#C9CED8'); b.r(42, 35, 10, 3, '#9AA1AD'); // microondas
      b.r(70, 35, 6, 5, '#F2C14E'); b.r(80, 36, 5, 4, '#7FD1AE'); // tazas
      // nevera y vending
      b.r(120, 6, 22, WALL_H - 8, '#E8ECF2'); b.r(121, 7, 20, 22, '#F6F8FB'); b.r(138, 12, 1, 10, '#9AA1AD'); b.r(138, 34, 1, 14, '#9AA1AD');
      b.r(146, 6, 24, WALL_H - 8, '#C0392B'); b.r(149, 10, 14, 34, '#2B2F3D');
      for (let i = 0; i < 12; i++) b.r(151 + (i % 3) * 4, 12 + Math.floor(i / 3) * 8, 3, 5, ['#F2C14E', '#7FD1AE', '#E85D75', '#8EC5FF'][i % 4]);
      ctx.strokeStyle = OUT; ctx.strokeRect(119.5, 5.5, 23, WALL_H - 7); ctx.strokeRect(145.5, 5.5, 25, WALL_H - 7);
      // reloj de pared
      b.r(92, 12, 12, 12, '#FFFFFF'); b.r(97, 14, 1, 5, '#2B2F3D'); b.r(97, 18, 4, 1, '#2B2F3D');
    },
    front(ctx) {
      put(ctx, tableFront(60, '#F6F2EA'), 58, 112);
      const stool = spr('stool', 8, 12, (bb) => { bb.r(0, 0, 8, 3, '#E3884B'); bb.r(3, 3, 2, 8, '#8D97A8'); bb.r(1, 11, 6, 1, '#8D97A8'); });
      for (const x of [56, 76, 96, 116]) put(ctx, stool, x, 134);
    },
    slots: [[40, 100, 1], [96, 102, 1], [140, 104, 1], [44, 142, 1], [150, 142, 1], [86, 146, 1]],
  },
  descanso: {
    label: 'Zona chill', floor: 'wood', wall: '#E4D3EE',
    back(ctx, env) {
      wallScreen(40, 24, 'tv')(ctx, 68, 10, env.now);
      frame(ctx, 16, 14, 20, 16, '#7CC453'); frame(ctx, 136, 12, 22, 20, '#E85D75');
      put(ctx, plant(true), 2, WALL_H - 14); put(ctx, plant(true), SW - 18, WALL_H - 14);
      const b = brush(ctx);
      // alfombra
      b.r(20, 100, 136, 30, '#4E7FB8'); b.r(24, 103, 128, 24, '#5A8CC4');
      for (let x = 28; x < 150; x += 8) b.r(x, 114, 4, 1, '#7FB0E0');
      // sofá al fondo
      put(ctx, spr('sofa', 80, 26, (bb) => {
        bb.r(0, 6, 80, 16, '#4C4FA8'); bb.r(4, 0, 72, 10, '#5C60C2'); bb.r(0, 6, 8, 16, '#3E4192'); bb.r(72, 6, 8, 16, '#3E4192');
        bb.r(10, 12, 28, 6, '#6A6FD4'); bb.r(42, 12, 28, 6, '#6A6FD4'); bb.r(4, 22, 4, 4, '#2E3060'); bb.r(72, 22, 4, 4, '#2E3060');
        bb.r(14, 4, 10, 6, '#F2C14E');
      }), 48, 70);
    },
    front(ctx) {
      put(ctx, spr('beanbag', 18, 12, (bb) => { bb.r(1, 2, 16, 10, '#E85D75'); bb.r(3, 0, 12, 4, '#F07A8F'); }), 8, 132);
      put(ctx, spr('ctable', 34, 10, (bb) => { bb.r(0, 0, 34, 4, '#C28A55'); bb.r(2, 4, 2, 6, '#946236'); bb.r(30, 4, 2, 6, '#946236'); bb.r(6, -3, 8, 3, '#F6F2EA'); bb.r(20, -2, 4, 2, '#E3584B'); }), 72, 128);
    },
    slots: [[70, 90, 1], [104, 90, 1], [32, 128, 1], [150, 132, 1], [88, 144, 1]],
  },
  terraza: {
    label: 'Terraza', floor: 'deck', wall: null, outdoor: true,
    back(ctx, env) {
      paintOutdoor(ctx, env);
      const b = brush(ctx);
      // barandilla de cristal
      b.r(0, WALL_H - 14, SW, 1, '#8D97A8'); b.r(0, WALL_H, SW, 2, '#6E7890');
      ctx.fillStyle = 'rgba(190,225,245,0.25)'; ctx.fillRect(0, WALL_H - 13, SW, 13);
      for (let x = 0; x < SW; x += 22) b.r(x, WALL_H - 14, 2, 16, '#6E7890');
      // guirnalda
      for (let x = 0; x < SW; x++) {
        const sag = Math.round(Math.sin((x / SW) * Math.PI * 2) * 4 + 6);
        b.p(x, sag, '#3A3340');
        const bulbs = env.season === 'invierno' ? ['#E3584B', '#FFFFFF', '#3FAE5A', '#FFE066'] : ['#FFE066', '#F7A8C8', '#8EC5FF', '#B6F28E'];
        if (x % 10 === 5) b.r(x, sag + 1, 2, 2, bulbs[(x / 10) % 4 | 0]);
      }
      // sombrilla y mesa
      const um = spr(`umb${env.season}`, 50, 40, (bb) => {
        for (let x = 0; x < 50; x++) bb.r(x, Math.abs(x - 25) / 3, 1, 9 - Math.abs(x - 25) / 4, Math.floor(x / 6) % 2 ? '#E3584B' : '#FFF4E6');
        bb.r(24, 9, 2, 26, '#8D97A8'); bb.r(10, 26, 30, 3, '#F6F2EA'); bb.r(14, 29, 2, 10, '#8D97A8'); bb.r(34, 29, 2, 10, '#8D97A8');
      });
      if (env.season !== 'invierno') put(ctx, um, 100, 72);
      put(ctx, plant(true), 4, 84); put(ctx, plant(true), SW - 18, 84);
    },
    front(ctx) {
      put(ctx, spr('bench2', 44, 12, (bb) => { bb.r(0, 0, 44, 3, '#8A5A3A'); bb.r(0, 4, 44, 3, '#9A6640'); bb.r(2, 7, 3, 5, '#4A4A55'); bb.r(39, 7, 3, 5, '#4A4A55'); }), 20, 132);
    },
    slots: [[44, 100, 1], [76, 112, 1], [130, 102, 1], [60, 142, 1], [150, 142, 1]],
  },
  recepcion: {
    label: 'Recepción', floor: 'marble', wall: '#E7E0D2',
    back(ctx, env) {
      const b = brush(ctx);
      b.r(48, 8, 80, 20, '#2B2F3D'); b.r(52, 12, 14, 12, '#F2C14E');
      ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 9px monospace'; ctx.fillText('MAD OFFICE', 70, 22);
      windowOn(ctx, 140, 12, 28, 30, env);
      put(ctx, plant(true), 4, WALL_H - 16);
    },
    seatsBehind: true,
    front(ctx) {
      put(ctx, spr('counter', 96, 26, (bb) => {
        bb.r(0, 0, 96, 5, '#F6F2EA'); bb.r(0, 5, 96, 21, '#2F8C86'); bb.r(0, 5, 96, 2, '#3FA9A2');
        bb.r(30, 12, 36, 4, '#F2C14E'); bb.r(80, -4, 6, 4, '#C9A040');
      }), 40, 84);
      const chair = spr('arm', 20, 16, (bb) => { bb.r(0, 4, 20, 12, '#C0392B'); bb.r(2, 0, 16, 6, '#E3584B'); bb.r(0, 4, 3, 12, '#9E2E22'); bb.r(17, 4, 3, 12, '#9E2E22'); });
      put(ctx, chair, 8, 128); put(ctx, chair, SW - 28, 128);
    },
    slots: [[88, 92, 0], [60, 138, 1], [118, 138, 1], [36, 130, 1]],
  },
  despacho: {
    label: 'Despacho del jefe', floor: 'parquet', wall: '#D9C7A8',
    back(ctx, env) {
      const b = brush(ctx);
      // estantería con libros
      b.r(8, 6, 44, WALL_H - 8, '#7A4B2C'); b.r(10, 8, 40, WALL_H - 12, '#5A3520');
      for (let s = 0; s < 3; s++) {
        b.r(10, 22 + s * 14, 40, 2, '#7A4B2C');
        for (let i = 0; i < 9; i++) b.r(11 + i * 4, 11 + s * 14, 3, 11, ['#E3584B', '#4E7FB8', '#F2C14E', '#3FAE5A', '#E8ECF2'][(i + s) % 5]);
      }
      windowOn(ctx, 68, 12, 40, 28, env);
      frame(ctx, 124, 14, 18, 22, '#C9A040'); // diploma
      b.r(150, 26, 10, 3, '#C9A040'); b.r(153, 18, 4, 8, '#F2C14E'); b.r(151, 16, 8, 3, '#F2C14E'); // trofeo
      // alfombra roja
      b.r(24, 96, 128, 40, '#8E2B2B'); b.r(28, 99, 120, 34, '#A83A33');
      for (let x = 32; x < 146; x += 6) b.p(x, 101, '#C9A040');
    },
    seatsBehind: true,
    front(ctx) {
      put(ctx, spr('bossdesk', 100, 24, (bb) => {
        bb.r(0, 0, 100, 6, '#A86D45'); bb.r(0, 6, 100, 16, '#6A3D24'); bb.r(0, 6, 100, 1, '#C9A040');
        bb.r(40, 12, 20, 3, '#C9A040'); bb.r(8, -6, 6, 6, '#2E8A5A'); bb.r(10, -8, 2, 2, '#F2C14E');
        bb.r(80, -4, 12, 4, '#F5F3EE');
      }), 38, 100);
    },
    slots: [[88, 104, 0], [44, 142, 1], [132, 142, 1], [88, 146, 1]],
  },
  servidores: {
    label: 'Servidores', floor: 'server', wall: '#A9B3C2',
    back(ctx, env) {
      for (let i = 0; i < 8; i++) rack(ctx, 6 + i * 21, 6, WALL_H + 20, env.now, i);
      const b = brush(ctx);
      b.r(0, 2, SW, 3, '#F2C14E'); for (let x = 0; x < SW; x += 6) b.r(x, 2, 3, 3, '#2B2F3D'); // bandeja de cables
      ctx.fillStyle = 'rgba(90,160,255,0.10)'; ctx.fillRect(0, 0, SW, SH);
    },
    front(ctx) {
      put(ctx, spr('sdesk', 50, 16, (bb) => { bb.r(0, 0, 50, 4, '#8D97A8'); bb.r(2, 4, 3, 12, '#5A6170'); bb.r(45, 4, 3, 12, '#5A6170'); bb.r(14, -8, 22, 8, '#2B2F3D'); bb.r(15, -7, 20, 6, '#3FAE5A'); }), 110, 124);
    },
    slots: [[50, 116, 1], [86, 128, 1], [30, 142, 1], [140, 112, 1]],
  },
  banos: {
    label: 'Baños', floor: 'bath', wall: '#CFE6EA',
    back(ctx) {
      const b = brush(ctx);
      for (let x = 0; x < SW; x += 8) b.r(x, 0, 1, WALL_H, '#B8D4D9');
      for (let i = 0; i < 3; i++) {
        const x = 14 + i * 34;
        b.r(x, 10, 22, 18, '#9AA1AD'); b.r(x + 1, 11, 20, 16, '#D6ECF5'); b.r(x + 3, 13, 6, 2, '#FFFFFF'); // espejo
        b.r(x - 2, 34, 26, 8, '#FFFFFF'); b.r(x + 2, 36, 18, 4, '#CFE6EA'); b.r(x + 10, 30, 2, 4, '#9AA1AD'); // lavabo
        ctx.strokeStyle = OUT; ctx.strokeRect(x - 0.5, 9.5, 23, 19); ctx.strokeRect(x - 2.5, 33.5, 27, 9);
      }
      // puertas de los aseos
      for (const x of [118, 146]) { b.r(x, 8, 24, WALL_H - 8, '#7FA7C9'); b.r(x + 2, 10, 20, WALL_H - 12, '#8EB8DA'); b.r(x + 18, 34, 2, 3, '#2B2F3D'); ctx.strokeStyle = OUT; ctx.strokeRect(x - 0.5, 7.5, 25, WALL_H - 7); }
      b.r(100, 14, 10, 12, '#E8ECF2'); b.r(102, 22, 6, 2, '#2B2F3D'); // secamanos
    },
    slots: [[40, 116, 1], [80, 128, 1], [130, 138, 1], [20, 142, 1]],
  },
};

export function sceneDef(roomId) {
  return ROOMS[roomId] || ROOMS.pasillo;
}

// Pared, suelo y muebles del fondo.
export function paintBack(ctx, roomId, env) {
  const r = sceneDef(roomId);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, SW, SH);
  paintFloor(ctx, r.floor);
  if (!r.outdoor) paintWall(ctx, r.wall);
  r.back(ctx, env);
}

// Los muebles de delante (tapan las piernas de la fila de atrás).
export function paintFurniture(ctx, roomId, env) {
  const r = sceneDef(roomId);
  if (r.front) r.front(ctx, env);
}

// Al final, encima de todo: el tiempo (si es exterior) y la luz de la hora.
export function paintLight(ctx, roomId, env) {
  const r = sceneDef(roomId);
  if (r.outdoor) {
    drawOutdoorTint(ctx, { x: 0, y: 0, w: SW, h: SH }, env.w, env.now);
    drawPrecip(ctx, { x: 0, y: 0, w: SW, h: SH }, weatherKind(env.w), env.now, { wind: env.w ? env.w.wind : 0 });
  }
  if (env.night && !r.outdoor) {
    ctx.fillStyle = 'rgba(14,20,62,0.45)';
    ctx.fillRect(0, 0, SW, SH);
    const g = ctx.createRadialGradient(SW / 2, 20, 0, SW / 2, 20, 90);
    g.addColorStop(0, 'rgba(255,214,140,0.35)'); g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
    ctx.globalCompositeOperation = 'source-over';
  } else if (env.night && r.outdoor) {
    ctx.fillStyle = 'rgba(14,20,62,0.35)';
    ctx.fillRect(0, 0, SW, SH);
  }
}

// Dónde va cada personaje: reparte por los huecos de la sala (los de detrás primero si se sientan).
export function slotsFor(roomId, n) {
  const r = sceneDef(roomId);
  const s = r.slots.slice(0, Math.max(n, 0)).map(x => x.slice());
  while (s.length < n) {
    const i = s.length;
    s.push([40 + ((i * 29) % (SW - 80)), 124 + (i % 2) * 4, 1]);
  }
  // Que quepan en el círculo de la lupa (centro de la escena, radio SH/2): los pies no más
  // abajo de 130 y dentro de la cuerda a esa altura.
  const R = SH / 2;
  return s.map(([x, y, row]) => {
    const yy = Math.min(y, 130);
    const hw = Math.sqrt(Math.max(0, R * R - (yy - R) * (yy - R))) - 12;
    return [Math.max(SW / 2 - hw, Math.min(SW / 2 + hw, x)), yy, row];
  });
}

export const SCENE_IDS = Object.keys(ROOMS);
