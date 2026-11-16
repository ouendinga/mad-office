import React, { useEffect, useMemo, useRef, useState } from 'react';
import { characterSprite } from '../engine/Character';
import { motifsFor, drawMotif } from '../engine/motifs';

// Mientras la IA escribe la ficha: escena de transformación (estilo anime de los 90). Lo que la
// persona ha contado se convierte en motivos de pixel art que giran alrededor de su avatar, la
// silueta parpadea entre luz y color, y al llegar la ficha hay un fogonazo y aparece «nacido».
// Todo por reglas y en el navegador: no gasta IA.
const W = 160;
const H = 120;
const RAYS = ['#ff79c6', '#a29bfe', '#fde047', '#74b9ff'];

const PHRASES = [
  a => `Fundiendo «${a}»…`,
  a => `Añadiendo una pizca de «${a}»…`,
  a => `Destilando la esencia de «${a}»…`,
  a => `Grabando «${a}» en su alma…`,
];

export default function Transformacion({ avatar, answers, name, done, onFinish }) {
  const ref = useRef(null);
  const doneAt = useRef(null);
  const finished = useRef(false);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const motifs = useMemo(() => motifsFor(answers), [answers]);
  const bits = useMemo(() => Object.values(answers || {}).map(s => String(s).trim()).filter(Boolean)
    .map(s => (s.length > 38 ? `${s.slice(0, 36)}…` : s)), [answers]);
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (done && doneAt.current == null) doneAt.current = performance.now();
  }, [done]);

  // Frases que van pasando, con las palabras de la propia persona.
  useEffect(() => {
    const id = setInterval(() => setLine(n => n + 1), 1700);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const sprite = characterSprite(avatar || {});
    // Silueta blanca del avatar (la «luz» de la transformación).
    const sil = document.createElement('canvas');
    sil.width = sprite.width;
    sil.height = sprite.height;
    const sctx = sil.getContext('2d');
    sctx.drawImage(sprite, 0, 0);
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = '#ffffff';
    sctx.fillRect(0, 0, sil.width, sil.height);

    const stars = Array.from({ length: 40 }, (_, i) => ({ x: (i * 37) % W, y: (i * 53) % H, p: i * 0.7 }));
    const sparks = [];
    const t0 = performance.now();
    let raf;
    const cx = W / 2;
    const cy = 52;

    const frame = now => {
      const t = (now - t0) / 1000;
      const end = doneAt.current != null ? (now - doneAt.current) / 1000 : null;
      // Fondo: degradado morado y estrellas que titilan.
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 110);
      g.addColorStop(0, '#3b1f6e');
      g.addColorStop(1, '#0b0820');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      for (const s of stars) {
        if (Math.sin(t * 3 + s.p) > 0.3) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(s.x, s.y, 1, 1);
        }
      }
      // Rayos de luz girando detrás.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.6);
      for (let i = 0; i < 12; i++) {
        ctx.rotate((Math.PI * 2) / 12);
        ctx.globalAlpha = 0.18 + 0.1 * Math.sin(t * 4 + i);
        ctx.fillStyle = RAYS[i % RAYS.length];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-7, -120);
        ctx.lineTo(7, -120);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      // Motivos: entran en espiral y giran; al final se colocan en fila bajo el avatar.
      const n = motifs.length;
      motifs.forEach((key, i) => {
        const a = t * 1.2 + (i * Math.PI * 2) / n;
        const enter = Math.min(1, Math.max(0, (t - i * 0.25) / 1.2));
        const r = 44 + (1 - enter) * 70;
        let x = cx + Math.cos(a) * r - 8;
        let y = cy + Math.sin(a) * r * 0.6 - 8;
        if (end != null) {
          const k = Math.min(1, end / 0.8);
          const tx = cx - (n * 18) / 2 + i * 18 + 1;
          const ty = 96;
          x = x + (tx - x) * k;
          y = y + (ty - y) * k;
        }
        drawMotif(ctx, key, x, y, 2, enter);
      });

      // El avatar: silueta de luz que late; al final, color con un fogonazo.
      const size = 48;
      const bob = end == null ? Math.sin(t * 2) * 2 : 0;
      const ax = cx - size / 2;
      const ay = cy - size / 2 - 4 + bob;
      if (end == null) {
        const colorOn = Math.sin(t * 5) > 0.55;
        ctx.drawImage(colorOn ? sprite : sil, ax, ay, size, size);
      } else {
        ctx.drawImage(sprite, ax, ay, size, size);
      }

      // Chispas.
      if (Math.random() < (end != null && end < 0.6 ? 1 : 0.35)) {
        const a = Math.random() * Math.PI * 2;
        sparks.push({ x: cx + Math.cos(a) * 10, y: cy + Math.sin(a) * 10, vx: Math.cos(a) * (1 + Math.random() * 2), vy: Math.sin(a) * (1 + Math.random() * 2), life: 1, c: RAYS[Math.floor(Math.random() * RAYS.length)] });
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.03;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        ctx.globalAlpha = s.life;
        ctx.fillStyle = s.c;
        ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
      }
      ctx.globalAlpha = 1;

      // Fogonazo final.
      if (end != null && end < 0.5) {
        ctx.globalAlpha = 1 - end / 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      if (end != null && end > 2.4 && !finished.current) {
        finished.current = true;
        if (finishRef.current) finishRef.current();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [avatar, motifs]);

  const caption = done
    ? `✨ ¡${name} ha nacido!`
    : bits.length ? PHRASES[line % PHRASES.length](bits[line % bits.length]) : 'Reuniendo tu esencia…';

  return (
    <div className="transfo" role="status" aria-live="polite">
      <div className="transfo-title">{done ? '¡Transformación completa!' : 'Transformación en curso'}</div>
      <canvas ref={ref} width={W} height={H} className="transfo-canvas" aria-label={`Animación: se está formando el personaje de ${name}`} />
      <p className="transfo-caption" key={done ? 'fin' : line}>{caption}</p>
    </div>
  );
}
