/**
 * Arte de la oficina, dibujado por código a 16 px por casilla:
 * - suelos con textura, continuos entre casillas (madera, parquet, moqueta, mármol…)
 * - paredes con frente (vista 3/4) del color de cada sala
 * - muebles con contorno, sombreado y sombra en el suelo
 * Nada de imágenes externas: todo sale de aquí.
 */

import { makeCanvas, shade, hash, brush, outline } from './pixel';

export const T = 16;

// Estación del año: cambia el césped, los árboles, las jardineras y las guirnaldas.
// El renderer la pone con setSeason() y reconstruye la capa estática si cambia.
let SEASON = 'otono';
export function setSeason(season) {
  const s = ['invierno', 'primavera', 'verano', 'otono'].includes(season) ? season : 'otono';
  if (s === SEASON) return false;
  SEASON = s;
  cache.clear();
  return true;
}
export function getSeason() { return SEASON; }
const OUT = '#2A1F2D';

// --- suelos: una función por tipo que da el color de cada píxel (coordenadas globales) ---

const rgb = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const add = (c, d) => [c[0] + d, c[1] + d, c[2] + d];

const FLOORS = {
  wood(X, Y) {
    const row = Math.floor(Y / 5);
    const off = Math.floor(hash(row, 7) * 40);
    const plank = Math.floor((X + off) / 36);
    let c = add(rgb('#C99A62'), Math.floor(hash(plank, row) * 22) - 11);
    if (Y % 5 === 4) c = add(c, -38);
    else if ((X + off) % 36 === 0) c = add(c, -30);
    else if (hash(X, Y, 3) > 0.93) c = add(c, -10);
    else if (Y % 5 === 0) c = add(c, 10);
    return c;
  },
  parquet(X, Y) {
    const cx = Math.floor(X / 8);
    const cy = Math.floor(Y / 8);
    const horiz = (cx + cy) % 2 === 0;
    const lx = X % 8;
    const ly = Y % 8;
    const strip = horiz ? Math.floor(ly / 4) : Math.floor(lx / 4);
    let c = add(rgb('#9C6438'), Math.floor(hash(cx * 2 + strip, cy) * 20) - 10);
    if ((horiz ? ly % 4 === 3 : lx % 4 === 3)) c = add(c, -30);
    if (lx === 7 || ly === 7) c = add(c, -18);
    return c;
  },
  carpet(X, Y) {
    const tx = Math.floor(X / 16);
    const ty = Math.floor(Y / 16);
    let c = rgb((tx + ty) % 2 ? '#7487A8' : '#6E81A2');
    const n = hash(X, Y, 1);
    if (n > 0.8) c = add(c, 7); else if (n < 0.2) c = add(c, -7);
    if ((tx + ty) % 2 ? (X + Y) % 4 === 0 : (X - Y) % 4 === 0) c = add(c, 4);
    return c;
  },
  marble(X, Y) {
    let c = rgb('#ECE6DA');
    const v = Math.sin((X + Y * 0.6) * 0.35 + Math.sin(Y * 0.21) * 3);
    if (v > 0.93) c = rgb('#CFC5B3');
    if (hash(X, Y, 2) > 0.9) c = add(c, -6);
    if (X % 16 === 0 || Y % 16 === 0) c = rgb('#D2C8B5');
    return c;
  },
  tiles(X, Y) {
    const dark = (Math.floor(X / 8) + Math.floor(Y / 8)) % 2 === 1;
    let c = rgb(dark ? '#9FB8C4' : '#F1ECE1');
    if (X % 8 === 0 || Y % 8 === 0) c = add(c, -22);
    else if (X % 8 === 1 && Y % 8 === 1) c = add(c, 18);
    return c;
  },
  bath(X, Y) {
    let c = rgb('#D9EFF1');
    if (X % 4 === 0 || Y % 4 === 0) c = rgb('#B4D2D7');
    return c;
  },
  server(X, Y) {
    const lx = X % 8;
    const ly = Y % 8;
    let c = rgb('#56607A');
    if (lx === 0 || ly === 0) c = rgb('#6C7896');
    if (lx === 7 || ly === 7) c = rgb('#3E465B');
    if ((lx === 3 || lx === 5) && (ly === 3 || ly === 5)) c = rgb('#454E66');
    return c;
  },
  deck(X, Y) {
    const col = Math.floor(X / 6);
    let c = add(rgb('#B87F4D'), Math.floor(hash(col, Math.floor(Y / 40)) * 18) - 9);
    if (X % 6 === 5) c = add(c, -40);
    else if (X % 6 === 0) c = add(c, 12);
    if (Y % 40 === 0) c = add(c, -32);
    if ((Y % 40 === 3 || Y % 40 === 36) && X % 6 === 2) c = rgb('#6B4A30');
    if (SEASON === 'otono' && hash(X, Y, 9) > 0.992) c = rgb(['#D9822B', '#C4561F', '#E8B23A'][Math.floor(hash(X, Y, 10) * 3)]);
    return c;
  },
  grass(X, Y) {
    const pal = {
      primavera: ['#7CC453', '#86CC5B', '#70B84A', '#5DA63D'],
      verano: ['#6DBA43', '#7AC64C', '#5FAA3A', '#4E9A30'],
      otono: ['#93B85A', '#A0BF62', '#86AC50', '#728F42'],
      invierno: ['#A9BC8C', '#B4C597', '#9DB07F', '#8DA071'],
    }[SEASON];
    let c = rgb(pal[0]);
    const big = hash(Math.floor(X / 6), Math.floor(Y / 6), 4);
    if (big > 0.7) c = rgb(pal[1]);
    if (big < 0.15) c = rgb(pal[2]);
    const n = hash(X, Y, 5);
    if (n > 0.965) c = rgb(pal[3]);
    const flowers = { primavera: 0.99, verano: 0.996, otono: 2, invierno: 2 }[SEASON];
    if (n > flowers) c = rgb(['#FFFFFF', '#F7A8C8', '#FFE066', '#C9A7F2'][Math.floor(hash(X, Y, 6) * 4)]);
    // otoño: hojas caídas; invierno: escarcha
    if (SEASON === 'otono' && hash(X, Y, 7) > 0.975) c = rgb(['#D9822B', '#C4561F', '#E8B23A'][Math.floor(hash(X, Y, 8) * 3)]);
    if (SEASON === 'invierno' && hash(X, Y, 7) > 0.97) c = rgb('#EEF4F7');
    return c;
  },
};

// --- paredes ---

const CAP = '#4B4152';
const CAP_LIGHT = '#6A5D73';
const CAP_DARK = '#332B39';

function paintWallFace(b, x0, y0, wallColor) {
  // canto superior
  b.r(x0, y0, T, 4, CAP);
  b.r(x0, y0, T, 1, CAP_LIGHT);
  b.r(x0, y0 + 4, T, 1, CAP_DARK);
  // frente con moldura, paneles y zócalo
  b.r(x0, y0 + 5, T, 9, wallColor);
  b.r(x0, y0 + 5, T, 1, shade(wallColor, 22));
  b.r(x0, y0 + 9, T, 1, shade(wallColor, -10));
  b.r(x0 + 7, y0 + 10, 1, 4, shade(wallColor, -8));
  b.r(x0, y0 + 14, T, 2, '#7C5B3E');
  b.r(x0, y0 + 14, T, 1, '#9A7350');
}

function paintWallCap(b, x0, y0) {
  b.r(x0, y0, T, T, CAP);
  b.r(x0 + 1, y0 + 1, T - 2, T - 2, shade(CAP, 6));
  b.r(x0, y0, T, 1, CAP_LIGHT);
  b.r(x0, y0 + T - 1, T, 1, CAP_DARK);
}

// --- lienzo estático: suelos + paredes + lo que va pegado al suelo o a la pared ---

export function roomAt(map, x, y) {
  return map.rooms.find(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) || null;
}

function floorTypeAt(map, x, y) {
  const ch = map.grid[y][x];
  if (ch === ',') return 'grass';
  if (ch === '=') return 'deck';
  const room = roomAt(map, x, y);
  if (room) return room.floor;
  // puertas: el suelo de la sala de abajo o de al lado
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const r = roomAt(map, x + dx, y + dy);
    if (r && map.grid[y + dy][x + dx] !== '#') return r.floor;
  }
  return 'wood';
}

export function buildStatic(map) {
  const W = map.cols * T;
  const H = map.rows * T;
  const { canvas, ctx } = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);
  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx = 0; tx < map.cols; tx++) {
      const f = FLOORS[floorTypeAt(map, tx, ty)] || FLOORS.wood;
      for (let y = 0; y < T; y++) {
        for (let x = 0; x < T; x++) {
          const X = tx * T + x;
          const Y = ty * T + y;
          const c = f(X, Y);
          const i = (Y * W + X) * 4;
          img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const b = brush(ctx);

  // sombra suave del edificio sobre la terraza
  ctx.fillStyle = 'rgba(40,20,30,0.18)';
  ctx.fillRect(32 * T, 1 * T, 6, 24 * T);

  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx = 0; tx < map.cols; tx++) {
      const ch = map.grid[ty][tx];
      if (ch === 'D') {
        // umbral de la puerta
        const horizontalWall = map.grid[ty][tx - 1] === '#' || map.grid[ty][tx + 1] === '#';
        ctx.fillStyle = 'rgba(60,40,30,0.25)';
        if (horizontalWall) ctx.fillRect(tx * T, ty * T + 6, T, 4); else ctx.fillRect(tx * T + 6, ty * T, 4, T);
        continue;
      }
      if (ch !== '#') continue;
      const below = ty + 1 < map.rows ? map.grid[ty + 1][tx] : '#';
      if (below === '.' || below === 'D') {
        const room = roomAt(map, tx, ty + 1);
        paintWallFace(b, tx * T, ty * T, (room && room.wall) || '#E9DFCC');
      } else {
        paintWallCap(b, tx * T, ty * T);
      }
      // sombra que proyecta la pared sobre el suelo de abajo
      if (below === '.' || below === 'D') {
        ctx.fillStyle = 'rgba(40,25,40,0.22)';
        ctx.fillRect(tx * T, (ty + 1) * T, T, 3);
      }
    }
  }
  return canvas;
}

// --- muebles ---

const OBJ = {};
// def(nombre, fn(b, w, h, o) , { up, flat, overlay }): w/h en píxeles del hueco; `up` = lo que sobresale por arriba.
function def(name, fn, opts = {}) { OBJ[name] = { fn, ...opts }; }

const WOOD = '#C28A55';
const WOOD_D = '#946236';
const WOOD_L = '#DBA673';
const METAL = '#8D97A8';
const DARK = '#3B3F52';

function shadowOval(ctx, cx, cy, rx, ry, a = 0.22) {
  ctx.fillStyle = `rgba(30,15,30,${a})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function leaves(b, cx, cy, r, palette, seed) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = (x * x) / (r * r) + (y * y) / (r * r * 0.85);
      if (d > 1 + hash(x, y, seed) * 0.25) continue;
      const k = y < -r / 3 ? 2 : y > r / 3 ? 0 : 1;
      let c = palette[k];
      if (hash(x + 3, y, seed + 1) > 0.86) c = palette[Math.min(2, k + 1)];
      b.p(cx + x, cy + y, c);
    }
  }
}
const GREENS = ['#2F7D3A', '#3F9C45', '#62C055'];

def('desk', (b, w, h, o, ctx) => {
  // tablero y frente
  b.r(0, 2, w, 9, WOOD_L);
  b.r(0, 2, w, 1, '#EBC08E');
  b.r(0, 11, w, 4, WOOD_D);
  b.r(1, 15, 2, 1, DARK); b.r(w - 3, 15, 2, 1, DARK);
  // monitor visto por detrás: carcasa plateada, peana y un poco de luz de pantalla por los bordes
  b.r(8, -8, 16, 10, '#B9C0CD'); b.r(9, -7, 14, 8, '#D3D9E3'); b.r(9, -7, 14, 1, '#EEF1F6');
  b.r(15, -4, 2, 2, '#A3ABBA'); b.r(14, 2, 4, 1, '#8D97A8'); b.r(12, 3, 8, 1, '#8D97A8');
  // teclado no se ve (está al otro lado); papeles, taza y planta mini
  b.r(2, 4, 5, 4, '#F5F3EE'); b.r(3, 5, 3, 1, '#C9C4BA');
  // taza blanca con café (se lee como taza, no como mancha roja)
  b.r(22, 5, 3, 3, '#F2EFE8'); b.p(23, 5, '#6B4A30'); b.p(25, 6, '#F2EFE8');
  // planta mini: copa verde más ancha que la maceta, para que se lea como planta
  if (o.seed % 3 === 0) { b.r(28, 6, 3, 3, '#C66B3D'); b.r(27, 6, 5, 1, '#DA8256'); b.r(27, 3, 5, 2, '#3F9C45'); b.r(28, 2, 3, 1, '#62C055'); }
}, { up: 8 });

def('boss_desk', (b, w) => {
  b.r(0, 2, w, 9, '#8A5434'); b.r(0, 2, w, 1, '#A86D45');
  b.r(0, 11, w, 5, '#6A3D24'); b.r(0, 11, w, 1, '#C9A040');
  b.r(6, -6, 12, 8, DARK); b.r(7, -5, 10, 6, '#4A5068');
  b.r(30, -6, 1, 9, '#C9A040'); b.r(27, -8, 7, 3, '#2E8A5A'); // lámpara de banquero
  b.r(20, 5, 8, 2, '#C9A040'); // placa
  b.r(2, 4, 3, 4, '#F5F3EE');
}, { up: 8 });

def('counter', (b, w) => {
  b.r(0, 2, w, 5, '#F2EFE8'); b.r(0, 2, w, 1, '#FFFFFF');
  b.r(0, 7, w, 9, '#3E8E8A'); b.r(0, 7, w, 1, '#58A9A4');
  b.r(Math.floor(w / 2) - 10, 10, 20, 3, '#F2C14E'); // franja del logo
  b.r(6, -5, 10, 7, DARK); b.r(7, -4, 8, 5, '#4A5068');
  b.r(w - 10, 0, 4, 2, '#C9A040'); b.p(w - 8, -1, '#C9A040'); // timbre
}, { up: 6 });

def('plant', (b, w, h, o) => {
  b.r(4, 9, 8, 6, '#C66B3D'); b.r(3, 8, 10, 2, '#DA8256'); b.r(5, 14, 6, 1, '#9C4F2B');
  leaves(b, 8, 3, 6, GREENS, o.seed);
}, { up: 6 });

def('plant_big', (b, w, h, o) => {
  b.r(3, 9, 10, 6, '#E8E2D6'); b.r(2, 8, 12, 2, '#F6F2EA'); b.r(4, 14, 8, 1, '#BDB4A3');
  leaves(b, 8, -2, 8, ['#256B33', '#358A41', '#57B04F'], o.seed);
  leaves(b, 4, -9, 4, ['#256B33', '#358A41', '#57B04F'], o.seed + 2);
  leaves(b, 12, -10, 4, ['#256B33', '#358A41', '#57B04F'], o.seed + 3);
}, { up: 15 });

// Silla de oficina vista de frente: el respaldo asoma por detrás de quien se sienta (o se ve
// entera si la mesa está vacía). La del jefe, de piel y más alta.
def('office_chair', (b, w, h, o) => {
  const boss = o.color === 'boss';
  const back = boss ? '#5A2E1E' : '#4C5675';
  const light = boss ? '#7A4430' : '#66729A';
  const cx = Math.floor(w / 2);
  const bw = boss ? 20 : 16;
  const top = boss ? -14 : -8;
  b.r(cx - bw / 2 + 1, top, bw - 2, 1, back); b.r(cx - bw / 2, top + 1, bw, 16 - top - 5, back); // esquinas redondas
  b.r(cx - bw / 2 + 2, top + 2, bw - 4, 2, light);
  b.r(cx - bw / 2 - 1, 8, bw + 2, 4, back); // asiento
  b.r(cx - bw / 2 - 2, 6, 2, 4, DARK); b.r(cx + bw / 2, 6, 2, 4, DARK); // reposabrazos
  b.r(cx - 1, 12, 2, 3, DARK); b.r(cx - 5, 15, 10, 1, DARK); // pie y ruedas
}, { up: 14, flat: true }); // flat: va en la capa de abajo, detrás de quien se sienta

// Silla de visitas (delante del despacho del jefe).
def('guest_chair', b => {
  b.r(3, -2, 10, 9, '#7A4B2C'); b.r(4, -1, 8, 2, '#9A6640');
  b.r(2, 7, 12, 4, '#8E3B46'); b.r(3, 11, 2, 4, '#5A3420'); b.r(11, 11, 2, 4, '#5A3420');
}, { up: 2, flat: true });

def('armchair', b => {
  b.r(1, 2, 14, 12, '#D9694C'); b.r(1, 2, 14, 2, '#EC8869'); b.r(1, 2, 3, 12, '#B9533A'); b.r(12, 2, 3, 12, '#B9533A');
  b.r(4, 6, 8, 5, '#E77D5E'); b.r(2, 14, 2, 2, DARK); b.r(12, 14, 2, 2, DARK);
}, { up: 2 });

def('sofa', (b, w) => {
  b.r(0, -2, w, 7, '#4E62AE'); b.r(0, -2, w, 1, '#6A7FC9');
  b.r(0, 5, w, 8, '#5B70BD'); b.r(0, 5, 4, 9, '#4458A0'); b.r(w - 4, 5, 4, 9, '#4458A0');
  for (let x = 4; x < w - 4; x += 13) b.r(x, 6, 12, 5, '#6A7FC9');
  b.r(6, 0, 7, 4, '#F2C14E'); // cojín
  b.r(1, 14, 2, 2, DARK); b.r(w - 3, 14, 2, 2, DARK);
}, { up: 4 });

def('beanbag', (b, w, h, o) => {
  const c = o.color || '#C2477A';
  leaves(b, 8, 9, 7, [shade(c, -30), c, shade(c, 30)], 9);
}, { up: 0 });

// Mesa de ping-pong (2×2 casillas, en vertical: un jugador arriba y otro abajo).
def('pingpong', (b, w, h) => {
  b.r(3, 3, w - 6, h - 4, '#1F6E8C'); b.r(3, 3, w - 6, 1, '#2C8DB0');
  b.r(3, 3, 1, h - 4, '#FFFFFF'); b.r(w - 4, 3, 1, h - 4, '#FFFFFF'); b.r(3, h - 2, w - 6, 1, '#FFFFFF');
  b.r(Math.floor(w / 2), 3, 1, h - 4, '#FFFFFF'); // línea central
  b.r(1, Math.floor(h / 2) - 1, w - 2, 2, '#E8ECF2'); b.r(1, Math.floor(h / 2) - 2, 1, 4, METAL); b.r(w - 2, Math.floor(h / 2) - 2, 1, 4, METAL); // red
  b.r(5, h - 1, 2, 3, DARK); b.r(w - 7, h - 1, 2, 3, DARK);
  b.r(8, 6, 3, 3, '#C0392B'); b.r(w - 11, h - 9, 3, 3, '#C0392B'); // palas
}, { up: 0 });

// Mueble bajo la tele con la consola, dos mandos y unos juegos.
def('console', (b, w) => {
  b.r(0, 2, w, 10, WOOD_D); b.r(0, 2, w, 1, WOOD); b.r(1, 4, w - 2, 7, '#5A3B22');
  b.r(4, 5, 10, 4, '#F4F7F9'); b.r(5, 6, 3, 1, '#7FD1AE'); // consola
  b.r(17, 6, 4, 4, '#3E7CC9'); b.r(22, 6, 4, 4, '#E85D75'); b.r(27, 6, 3, 4, '#FFE066'); // juegos
  b.r(4, 0, 5, 2, '#2B2F3D'); b.r(w - 10, 0, 5, 2, '#2B2F3D'); // mandos
}, { up: 2 });

def('coffee_table', (b, w) => {
  b.r(0, 4, w, 7, WOOD); b.r(0, 4, w, 1, WOOD_L); b.r(0, 11, w, 2, WOOD_D);
  b.r(4, 5, 7, 4, '#E85D75'); b.r(14, 6, 6, 3, '#F2EFE8'); b.r(24, 5, 3, 3, '#FFFFFF');
}, { up: 0 });

def('bookshelf', (b, w) => {
  b.r(0, -16, w, 32, '#7A4B2C'); b.r(0, -16, w, 1, '#9A6640');
  const cols = ['#D94F4F', '#3E7CC9', '#F2C14E', '#4FA34A', '#9A5FC9', '#E8E2D6', '#E3884B'];
  for (const sy of [-13, -4, 5]) {
    b.r(2, sy + 7, w - 4, 1, '#5A341C');
    for (let x = 2; x < w - 2; x += 2) {
      const hgt = 5 + Math.floor(hash(x, sy, 8) * 3);
      if (hash(x, sy, 9) > 0.15) b.r(x, sy + 7 - hgt, 2, hgt, cols[Math.floor(hash(x, sy, 10) * cols.length)]);
    }
  }
}, { up: 16 });

def('trophy', b => {
  b.r(5, 9, 6, 2, '#6A3D24'); b.r(7, 6, 2, 3, '#C9A040'); b.r(4, 0, 8, 6, '#E8B931'); b.r(5, 1, 2, 3, '#FFE38A');
  b.r(2, 1, 2, 3, '#E8B931'); b.r(12, 1, 2, 3, '#E8B931');
}, { up: 0 });

def('meeting_table', (b, w, h) => {
  b.r(0, 2, w, h - 5, '#8A5A3A'); b.r(0, 2, w, 1, '#A87350'); b.r(2, 4, w - 4, h - 9, '#966442');
  b.r(0, h - 3, w, 3, '#6A4128');
  for (let x = 6; x < w - 8; x += 18) { b.r(x, 6, 8, 5, '#CED3DC'); b.r(x + 1, 7, 6, 3, '#6FA8DC'); }
  b.r(w - 12, 14, 6, 4, '#F5F3EE');
}, { up: 0 });

def('chairs_row', (b, w) => {
  for (let x = 2; x < w - 8; x += 16) { b.r(x, 2, 10, 10, '#424A63'); b.r(x + 1, 3, 8, 3, '#5A6380'); }
}, { up: 0 });

def('rack', (b, w, h, o) => {
  b.r(1, -18, 14, 34, '#262A36'); b.r(2, -17, 12, 32, '#333849'); b.r(1, -18, 14, 1, '#4A5068');
  for (let y = -15; y < 13; y += 4) {
    b.r(3, y, 10, 3, '#1C1F29');
    const on = hash(o.seed, y, o.frame || 0) > 0.35;
    b.p(4, y + 1, on ? '#4CF27A' : '#1F5A33');
    b.p(6, y + 1, hash(o.seed, y, 11 + (o.frame || 0)) > 0.6 ? '#4FC3F7' : '#1D3F5A');
    if (hash(o.seed, y, 12) > 0.8) b.p(8, y + 1, '#FFB347');
  }
}, { up: 18, frames: 3 });

def('ac_unit', b => {
  b.r(1, -10, 14, 24, '#DCE3EA'); b.r(1, -10, 14, 1, '#FFFFFF');
  for (let y = -6; y < 10; y += 3) b.r(3, y, 10, 1, '#A9B3C2');
  b.p(12, -8, '#4CF27A');
}, { up: 10 });

// Canaleta de cables al pie de los racks: de cada rack baja un mazo rojo y azul hasta la canaleta
// (antes eran tres rayas sueltas en mitad del suelo y nadie entendía qué eran).
def('cable_floor', (b, w) => {
  b.r(0, 5, w, 6, '#3E465B'); b.r(0, 5, w, 1, '#8D97A8');
  for (let x = 0; x < w; x += 4) b.r(x + 1, 7, 2, 2, '#262A36');
  for (let x = 0; x < w; x += 16) { b.r(x + 5, 0, 2, 6, '#E3584B'); b.r(x + 8, 0, 2, 6, '#3E7CC9'); }
}, { flat: true });

def('small_desk', (b, w) => {
  b.r(0, 2, w, 8, '#9AA3B5'); b.r(0, 10, w, 4, '#6E7891');
  b.r(6, -6, 14, 8, DARK); b.r(7, -5, 12, 6, '#1E2B3A');
  for (let y = -4; y < 0; y++) b.r(8, y, 3 + ((y * 7) % 9), 1, '#4CF27A');
}, { up: 6 });

def('water_cooler', b => {
  b.r(4, 3, 8, 12, '#E9EEF3'); b.r(4, 3, 8, 1, '#FFFFFF'); b.r(6, 7, 4, 2, '#9AA3B5');
  b.r(4, -9, 8, 11, '#7EC8F2'); b.r(5, -8, 2, 8, '#B9E5FB'); b.r(5, -11, 6, 2, '#4FA8DB');
}, { up: 11 });

def('printer', b => {
  b.r(0, 3, 16, 11, '#D7DCE3'); b.r(0, 3, 16, 1, '#F2F4F7'); b.r(2, 6, 12, 2, '#3B3F52');
  b.r(3, 0, 10, 4, '#FFFFFF'); b.p(13, 10, '#4CF27A');
}, { up: 1 });

def('kanban', (b, w) => {
  b.r(1, -16, w - 2, 22, '#F7F7F2'); b.r(1, -16, w - 2, 1, '#FFFFFF');
  b.r(Math.floor(w / 3), -14, 1, 18, '#D7D2C6'); b.r(Math.floor((2 * w) / 3), -14, 1, 18, '#D7D2C6');
  const notes = ['#FFE066', '#7FD1AE', '#F7A8C8', '#8EC5FF'];
  for (let i = 0; i < 10; i++) {
    const x = 3 + Math.floor(hash(i, 1, 13) * (w - 9));
    const y = -13 + Math.floor(hash(i, 2, 13) * 14);
    b.r(x, y, 4, 3, notes[i % 4]);
  }
  b.r(3, 6, 1, 9, METAL); b.r(w - 4, 6, 1, 9, METAL);
}, { up: 16 });

def('lamp', b => {
  b.r(7, -12, 2, 26, '#4A4A55'); b.r(4, 13, 8, 2, '#4A4A55');
  b.r(3, -18, 10, 7, '#F6E2A8'); b.r(3, -18, 10, 1, '#FFF4CC');
}, { up: 18, light: { dx: 8, dy: -14, r: 34 } });

def('kitchen_counter', (b, w) => {
  b.r(0, -2, w, 8, '#EEE8DC'); b.r(0, -2, w, 1, '#FFFFFF');
  b.r(0, 6, w, 10, '#5E9C8F'); for (let x = 0; x < w; x += 16) { b.r(x, 6, 1, 10, '#4A7F74'); b.r(x + 7, 9, 2, 3, '#C9A040'); }
  // cafetera, fregadero, microondas y frutero
  b.r(4, -11, 9, 10, '#3B3F52'); b.r(5, -10, 7, 3, '#5A6380'); b.r(7, -4, 3, 3, '#FFFFFF'); b.p(11, -9, '#E3584B');
  b.r(26, 0, 14, 4, '#A9B3C2'); b.r(31, -4, 2, 4, METAL);
  b.r(52, -9, 16, 8, '#DCE3EA'); b.r(54, -7, 9, 5, '#2B2F3D'); b.r(64, -7, 2, 5, '#A9B3C2');
  b.r(78, -3, 9, 3, '#E8E2D6'); b.p(80, -4, '#E3584B'); b.p(82, -5, '#F2C14E'); b.p(84, -4, '#7CC453');
}, { up: 11 });

def('fridge', b => {
  b.r(1, -18, 14, 34, '#E9EEF3'); b.r(1, -18, 14, 1, '#FFFFFF'); b.r(1, -6, 14, 1, '#B8C2CE');
  b.r(12, -15, 1, 6, '#9AA3B5'); b.r(12, -3, 1, 8, '#9AA3B5'); b.r(3, -15, 4, 3, '#FFE066');
}, { up: 18 });

def('vending', b => {
  b.r(0, -18, 16, 34, '#D94F4F'); b.r(0, -18, 16, 1, '#F07070');
  b.r(2, -15, 9, 20, '#1E2B3A');
  const c = ['#F2C14E', '#4FA34A', '#3E7CC9', '#F7A8C8'];
  for (let y = -13; y < 4; y += 4) for (let x = 3; x < 10; x += 3) b.r(x, y, 2, 3, c[(x + y + 20) % 4]);
  b.r(12, -12, 3, 6, '#2B2F3D'); b.r(12, -3, 3, 2, '#F2C14E');
}, { up: 18, light: { dx: 7, dy: -5, r: 18, color: '255,120,120' } });

def('kitchen_table', (b, w) => {
  b.r(0, 2, w, 9, '#F6F2EA'); b.r(0, 2, w, 1, '#FFFFFF'); b.r(0, 11, w, 2, '#C9C1B1');
  b.r(4, 4, 6, 4, '#E85D75'); b.r(20, 5, 4, 3, '#7CC453'); b.r(32, 4, 5, 4, '#FFE066');
  b.r(4, 13, 2, 3, METAL); b.r(w - 6, 13, 2, 3, METAL);
}, { up: 0 });

def('stools', (b, w) => {
  for (let x = 4; x < w - 6; x += 14) { b.r(x, 3, 8, 4, '#E3884B'); b.r(x + 3, 7, 2, 7, METAL); }
}, { up: 0 });

def('sink', b => {
  b.r(1, 3, 14, 8, '#F4F7F9'); b.r(3, 5, 10, 4, '#C9D9DE'); b.r(7, 0, 2, 4, METAL);
  b.r(2, -12, 12, 10, '#BFE3EE'); b.r(3, -11, 3, 8, '#E3F5FA'); // espejo
}, { up: 12 });

def('stall', b => {
  b.r(0, -16, 16, 32, '#7AA7B5'); b.r(0, -16, 16, 1, '#9CC6D3'); b.r(12, -2, 2, 2, '#C9A040');
  b.r(2, -12, 12, 1, '#6A95A3');
}, { up: 16 });

// Urinario en la pared derecha, con su mampara de separación arriba.
def('urinal', b => {
  b.r(14, 0, 2, 16, '#B8D4D9'); // azulejo de la pared
  b.r(8, 3, 6, 10, '#F4F7F9'); b.r(9, 5, 4, 6, '#C9D9DE'); b.r(12, 1, 2, 2, METAL);
  b.r(5, 0, 11, 1, '#9AA1AD'); // mampara
});

// Lavabo en la pared izquierda, con su espejo.
def('sink_side', b => {
  b.r(0, 1, 2, 14, '#BFE3EE'); b.r(0, 2, 1, 5, '#E3F5FA'); // espejo
  b.r(2, 3, 8, 10, '#F4F7F9'); b.r(3, 5, 5, 6, '#C9D9DE'); b.r(2, 7, 2, 2, METAL);
});

def('rug', (b, w, h, o) => {
  const c = o.color || '#8E3B46';
  b.r(0, 0, w, h, c);
  b.r(2, 2, w - 4, h - 4, shade(c, 18));
  b.r(4, 4, w - 8, h - 8, c);
  for (let x = 0; x < w; x += 4) { b.p(x, 0, shade(c, 40)); b.p(x + 2, h - 1, shade(c, 40)); }
}, { flat: true, noOutline: true });

def('planter', (b, w, h, o) => {
  b.r(1, 6, 14, 9, '#9A6640'); b.r(1, 6, 14, 1, '#B98055'); b.r(1, 10, 14, 1, '#7A4B2C');
  const pal = {
    primavera: ['#2F7D3A', '#3F9C45', '#62C055'],
    verano: ['#246B31', '#358F3E', '#55B44C'],
    otono: ['#7E6A2C', '#A08636', '#C9A040'],
    invierno: ['#4F6B55', '#5F7D63', '#7A957C'],
  }[SEASON];
  leaves(b, 8, 2, SEASON === 'invierno' ? 4 : 6, pal, o.seed);
  const fl = SEASON === 'otono' ? ['#D9822B', '#C4561F'] : ['#F7A8C8', '#FFE066', '#FFFFFF', '#F28C5B'];
  const n = { primavera: 8, verano: 5, otono: 3, invierno: 0 }[SEASON];
  for (let i = 0; i < n; i++) b.p(3 + Math.floor(hash(i, o.seed, 14) * 10), -1 + Math.floor(hash(i, o.seed, 15) * 6), fl[(i + o.seed) % fl.length]);
}, { up: 4 });

def('terrace_table', (b, w) => {
  // palo primero (detrás del tablero), luego el tablero con su pata corta: ya no lo atraviesa
  b.r(w / 2 - 1, -7, 2, 13, METAL);
  b.r(4, 6, w - 8, 6, '#F6F2EA'); b.r(4, 6, w - 8, 1, '#FFFFFF'); b.r(w / 2 - 1, 12, 2, 2, '#5E6675');
  // sombrilla a rayas, con una fila más oscura debajo para que no parezca flotar
  for (let x = 0; x < w; x++) {
    const top = -14 + Math.abs(x - w / 2) / 3;
    const hgt = 8 - Math.abs(x - w / 2) / 4;
    b.r(x, top, 1, hgt, Math.floor(x / 4) % 2 ? '#E3584B' : '#FFF4E6');
    b.r(x, Math.round(top + hgt), 1, 1, '#B84438');
  }
}, { up: 15 });

def('bench', (b, w) => {
  b.r(0, 2, w, 3, '#8A5A3A'); b.r(0, 6, w, 3, '#9A6640'); b.r(0, 9, w, 2, '#6A4128');
  b.r(2, 11, 2, 4, '#4A4A55'); b.r(w - 4, 11, 2, 4, '#4A4A55');
}, { up: 0 });

def('tree', (b, w, h, o, ctx) => {
  shadowOval(ctx, 16, 14, 13, 4, SEASON === 'invierno' ? 0.12 : 0.25);
  b.r(13, 2, 6, 13, '#7A4B2C'); b.r(13, 2, 2, 13, '#946236');
  if (SEASON === 'invierno') {
    // ramas peladas
    const br = '#6B4630';
    b.r(15, -14, 2, 16, br);
    for (let i = 0; i < 6; i++) {
      const y = -12 + i * 2;
      const len = 7 - Math.abs(i - 2);
      const dir = i % 2 ? 1 : -1;
      for (let k = 1; k <= len; k++) b.p(16 + dir * k, y - Math.floor(k / 2), br);
    }
    b.r(14, -16, 4, 2, br);
    return;
  }
  const pal = {
    primavera: ['#3B8A3F', '#55AE4F', '#86D06A'],
    verano: ['#1F6A30', '#2F8A3A', '#4FB04A'],
    otono: ['#A4471E', '#D9822B', '#F0B342'],
  }[SEASON];
  leaves(b, 16, -10, 13, pal, o.seed);
  if (SEASON === 'primavera') for (let i = 0; i < 12; i++) b.r(6 + Math.floor(hash(i, o.seed, 16) * 20), -20 + Math.floor(hash(i, o.seed, 17) * 20), 2, 1, i % 3 ? '#F7B6D2' : '#FFFFFF');
  if (SEASON === 'verano' && o.seed % 2) for (let i = 0; i < 5; i++) b.r(8 + Math.floor(hash(i, o.seed, 16) * 16), -18 + Math.floor(hash(i, o.seed, 17) * 14), 2, 2, '#E3584B');
  if (SEASON === 'otono') for (let i = 0; i < 4; i++) b.p(4 + Math.floor(hash(i, o.seed, 18) * 24), 12 + Math.floor(hash(i, o.seed, 19) * 3), '#D9822B');
}, { up: 24, wide: 2 });

def('string_lights', (b, w, h, o) => {
  for (let x = 0; x < w; x++) {
    const sag = Math.round(Math.sin((x / w) * Math.PI) * 5);
    b.p(x, sag, '#3A3340');
    const bulbs = SEASON === 'invierno' ? ['#E3584B', '#FFFFFF', '#3FAE5A', '#FFE066'] : ['#FFE066', '#F7A8C8', '#8EC5FF', '#B6F28E'];
    if (x % 8 === 4) b.r(x, sag + 1, 2, 2, bulbs[(x / 8) % 4 | 0]);
  }
}, { overlay: true, noOutline: true, lightRow: true });

// Decoración de pared: se pinta encima del frente de la pared (en la casilla de la pared).
def('wall_window', (b, w) => {
  b.r(1, 1, w - 2, 12, '#F0E8D8'); b.r(2, 2, w - 4, 10, '#8FD3F5'); b.r(2, 2, w - 4, 4, '#BDE8FB');
  b.r(Math.floor(w / 2), 2, 1, 10, '#F0E8D8'); b.r(3, 3, 2, 2, '#FFFFFF');
}, { wall: true, light: { dx: 8, dy: 14, r: 26, color: '150,180,255' } });
def('wall_logo', (b, w) => {
  b.r(2, 3, w - 4, 9, '#2B2F3D'); b.r(4, 5, 8, 5, '#F2C14E'); b.r(14, 6, w - 20, 1, '#FFFFFF'); b.r(14, 8, w - 26, 1, '#9AA3B5');
}, { wall: true });
def('wall_screen', (b, w) => {
  b.r(1, 1, w - 2, 12, '#1E2230'); b.r(2, 2, w - 4, 10, '#2F6FB0');
  b.r(4, 4, 10, 6, '#F2C14E'); b.r(16, 4, 10, 2, '#FFFFFF'); b.r(16, 8, 14, 2, '#7FD1AE'); b.r(34, 4, 10, 6, '#E85D75');
}, { wall: true, light: { dx: 24, dy: 8, r: 28, color: '120,170,255' } });
def('tv', (b, w) => {
  b.r(1, 1, w - 2, 12, '#1E2230'); b.r(2, 2, w - 4, 10, '#4D3C8F'); b.r(5, 4, 8, 6, '#F7A8C8'); b.r(16, 5, 12, 2, '#FFE066');
}, { wall: true, light: { dx: 16, dy: 8, r: 24, color: '200,140,255' } });
def('wall_kanban', (b, w) => {
  b.r(1, 1, w - 2, 12, '#F7F7F2'); const n = ['#FFE066', '#7FD1AE', '#F7A8C8', '#8EC5FF'];
  for (let i = 0; i < 9; i++) b.r(3 + (i % 3) * 9, 3 + Math.floor(i / 3) * 3, 6, 2, n[i % 4]);
}, { wall: true });
def('wall_art', (b, w, h, o) => {
  const c = ['#E3884B', '#4E7FB8', '#7CC453', '#E85D75'][o.seed % 4];
  b.r(2, 1, 12, 11, '#7A4B2C'); b.r(3, 2, 10, 9, '#F6F2EA'); b.r(4, 3, 8, 7, shade(c, 40));
  b.r(4, 7, 8, 3, c); b.r(7, 4, 3, 3, '#FFE066');
}, { wall: true });
def('wall_clock', b => {
  b.r(4, 2, 8, 8, '#FFFFFF'); b.r(4, 2, 8, 1, '#3B3F52'); b.r(8, 4, 1, 3, '#3B3F52'); b.r(8, 6, 2, 1, '#E3584B');
}, { wall: true });
def('wall_menu', (b, w) => {
  b.r(2, 1, w - 4, 11, '#2E3B33'); for (let y = 3; y < 11; y += 2) b.r(4, y, w - 10 - (y % 4) * 2, 1, '#F6F2EA');
}, { wall: true });

// --- construcción de los sprites de objetos ---

const cache = new Map();

export function objectSprite(o, seed, frame = 0) {
  const d = OBJ[o.type];
  if (!d) return null;
  const key = `${o.type}|${o.w || 1}|${o.h || 1}|${o.color || ''}|${seed}|${frame}|${SEASON}`;
  if (cache.has(key)) return cache.get(key);
  const w = (o.w || d.wide || 1) * T;
  const h = (o.h || 1) * T;
  const up = d.wall ? 0 : d.up || 0;
  const pad = 2;
  const { canvas, ctx } = makeCanvas(w + pad * 2, h + up + pad * 2);
  ctx.translate(pad, pad + up);
  d.fn(brush(ctx), w, h, { ...o, seed, frame }, ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!d.noOutline && !d.wall) outline(canvas, OUT);
  const out = { canvas, dx: -pad, dy: -pad - up };
  cache.set(key, out);
  return out;
}

export function objectDef(type) {
  return OBJ[type];
}
