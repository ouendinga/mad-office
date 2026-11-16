// Miniatura de un plano de oficina (para la galería): suelos, paredes y muebles, sin gente.
import { buildStatic, objectSprite, objectDef, prepareObjects, T } from '../engine/OfficeArt';

export function drawPlanPreview(canvas, plan) {
  const art = buildStatic(plan);
  const ctx = art.getContext('2d');
  const items = prepareObjects(plan.objects).map((o, i) => ({ o, i, d: objectDef(o.type) })).filter(x => x.d)
    .sort((a, b) => (a.d.flat || a.d.wall ? -1 : 0) - (b.d.flat || b.d.wall ? -1 : 0) || (a.o.y + (a.o.h || 1)) - (b.o.y + (b.o.h || 1)));
  for (const { o, i } of items) {
    const s = objectSprite(o, i + 1, 0);
    ctx.drawImage(s.canvas, o.x * T + s.dx, o.y * T + s.dy);
  }
  const out = canvas.getContext('2d');
  const scale = Math.min(canvas.width / art.width, canvas.height / art.height);
  out.imageSmoothingEnabled = false;
  out.fillStyle = '#1B1626';
  out.fillRect(0, 0, canvas.width, canvas.height);
  out.drawImage(art, Math.floor((canvas.width - art.width * scale) / 2), Math.floor((canvas.height - art.height * scale) / 2),
    art.width * scale, art.height * scale);
}
