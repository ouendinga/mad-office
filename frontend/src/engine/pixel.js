/**
 * Utilidades de pixel art: lienzos, color, ruido determinista y contorno automático.
 * Todo se dibuja a resolución «de arte» (16 px por casilla) y luego se escala sin suavizar.
 */

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas: c, ctx };
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, Math.round(v + amt)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 0xff);
  const b = f(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Hash entero → [0,1): la misma casilla siempre sale igual.
export function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Pinceles cortos para dibujar en un contexto.
export function brush(ctx) {
  return {
    r(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); },
    p(x, y, c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); },
  };
}

// Contorno: cada píxel transparente que toca uno opaco se pinta de `color`.
export function outline(canvas, color = '#2A1F2D') {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.getImageData(0, 0, w, h);
  const n = parseInt(color.slice(1), 16);
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src.data[(y * w + x) * 4 + 3]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (a(x, y) > 0) continue;
      if (a(x + 1, y) || a(x - 1, y) || a(x, y + 1) || a(x, y - 1)) {
        const i = (y * w + x) * 4;
        out.data[i] = n >> 16;
        out.data[i + 1] = (n >> 8) & 0xff;
        out.data[i + 2] = n & 0xff;
        out.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}
