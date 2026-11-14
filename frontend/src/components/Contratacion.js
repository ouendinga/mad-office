import React, { useEffect, useMemo, useRef, useState } from 'react';
import { characterSprite } from '../engine/Character';

// ¡Contratado! Al aprobar la ficha por primera vez: el personaje está en su casa y le llega la
// noticia por un canal al azar (carta, móvil, correo o paloma mensajera). Luego, la carta con
// la empresa y el cargo, y a la oficina. Sin IA.
const W = 160;
const H = 120;

const CHANNELS = {
  carta: {
    icon: '✉️', titulo: 'Ha llegado una carta',
    texto: (n, c, p) => `Hola, ${n}: nos complace comunicarte que ${c} te ha contratado como ${p}. Incorporación inmediata. Trae taza propia. — RRHH`,
  },
  movil: {
    icon: '📱', titulo: 'SMS de un número desconocido',
    texto: (n, c, p) => `${c}: ¡Enhorabuena, ${n}! Eres nuestro nuevo fichaje: ${p}. Mañana a las 9. No llegues tarde (o sí, como todos).`,
  },
  correo: {
    icon: '📧', titulo: 'Asunto: ¡Bienvenida a bordo! 🎉',
    texto: (n, c, p) => `Hola, ${n}. Desde ${c} nos alegra darte la bienvenida como ${p}. Adjuntamos 47 PDFs de onboarding que nadie se lee.`,
  },
  paloma: {
    icon: '🕊️', titulo: 'Una paloma mensajera en la ventana',
    texto: (n, c, p) => `Trae un pergamino: «${c} nombra a ${n} ${p}». La paloma espera propina y no piensa irse sin ella.`,
  },
};

export default function Contratacion({ avatar, name, company, position, onDone }) {
  const ref = useRef(null);
  const channel = useMemo(() => {
    const keys = Object.keys(CHANNELS);
    return keys[Math.floor(Math.random() * keys.length)];
  }, []);
  const [showLetter, setShowLetter] = useState(false);

  useEffect(() => {
    const ctx = ref.current.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const sprite = characterSprite(avatar || {});
    const t0 = performance.now();
    let raf;
    let shown = false;
    const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

    const frame = now => {
      const t = (now - t0) / 1000;
      // La casa: pared, suelo de madera, ventana con cielo, sofá, mesita y una planta.
      px(0, 0, W, 84, '#4a3b6b');
      for (let x = 0; x < W; x += 16) px(x, 0, 1, 84, '#433562');
      px(0, 84, W, 36, '#8b5a2b');
      for (let y = 88; y < H; y += 6) px(0, y, W, 1, '#7a4e25');
      px(14, 18, 36, 28, '#2c2147');
      px(16, 20, 32, 24, '#87ceeb');
      px(31, 20, 2, 24, '#2c2147');
      px(16, 31, 32, 2, '#2c2147');
      px(20, 23, 6, 3, '#ffffff');
      px(104, 62, 44, 22, '#c0392b');
      px(104, 56, 44, 8, '#e74c3c');
      px(102, 60, 4, 24, '#a93226');
      px(146, 60, 4, 24, '#a93226');
      px(70, 74, 26, 4, '#5d4037');
      px(72, 78, 2, 8, '#5d4037');
      px(92, 78, 2, 8, '#5d4037');
      px(6, 70, 8, 14, '#b5651d');
      px(4, 58, 12, 12, '#27ae60');
      px(60, 6, 18, 12, '#f5f5f5');
      px(61, 7, 16, 10, '#fde68a');

      // El personaje: tranquilo; al llegar la noticia, salta de alegría.
      const arrive = 1.3;
      const jump = t > arrive + 1 ? Math.abs(Math.sin((t - arrive - 1) * 7)) * 8 : 0;
      ctx.drawImage(sprite, 36, 50 - jump, 34, 34);
      if (t > arrive + 1) {
        px(52, 38 - jump, 3, 7, '#fde047');
        px(52, 46 - jump, 3, 2, '#fde047');
      }

      // La noticia, según el canal.
      const k = Math.min(1, Math.max(0, (t - 0.4) / (arrive - 0.4)));
      if (channel === 'carta') {
        const x = 150 - k * 70;
        const y = 70 + Math.sin(k * Math.PI) * -30;
        px(x, y, 12, 8, '#fdf6e3');
        px(x + 1, y + 1, 10, 1, '#e1d5b5');
        px(x + 5, y + 3, 2, 2, '#c0392b');
      } else if (channel === 'movil') {
        const shake = t > 0.5 && t < arrive + 1.2 ? Math.round(Math.sin(t * 60)) : 0;
        px(80 + shake, 66, 7, 10, '#222233');
        px(81 + shake, 67, 5, 7, t > 0.5 ? '#74b9ff' : '#334');
        if (t > 0.5 && Math.sin(t * 10) > 0) { px(76, 64, 2, 2, '#fde047'); px(89, 64, 2, 2, '#fde047'); }
      } else if (channel === 'correo') {
        px(76, 64, 16, 10, '#3d3d5c');
        px(77, 65, 14, 8, t > 0.6 ? '#dfe6e9' : '#1e272e');
        px(74, 74, 20, 2, '#2d3436');
        if (t > 0.6) { px(80, 67, 8, 4, '#ffffff'); px(80, 67, 8, 1, '#e17055'); }
        if (t > 0.6 && Math.sin(t * 8) > 0) px(90, 62, 4, 4, '#e74c3c');
      } else {
        const x = -10 + k * 62;
        const y = 22 + Math.sin(t * 12) * 2 + k * 20;
        px(x, y, 8, 5, '#dfe6e9');
        px(x + 7, y - 1, 3, 3, '#b2bec3');
        px(x + 2, y - 3 + (Math.sin(t * 20) > 0 ? 0 : 5), 4, 3, '#ffffff');
        px(x + 1, y + 5, 4, 3, '#fdf6e3');
      }

      if (t > arrive + 1.6 && !shown) {
        shown = true;
        setShowLetter(true);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [avatar, channel]);

  const ch = CHANNELS[channel];
  return (
    <div className="onb">
      <div className="onb-card contrato">
        <h1 className="pixel-font onb-title">¡Contratado!</h1>
        <canvas ref={ref} width={W} height={H} className="transfo-canvas" aria-label={`${name} recibe la noticia en casa`} />
        {showLetter ? (
          <div className="contrato-carta" role="status">
            <div className="contrato-head">{ch.icon} {ch.titulo}</div>
            <p>{ch.texto(name, company, position)}</p>
            <button type="button" className="btn btn-primary" onClick={onDone} autoFocus>¡A la oficina! 🏢</button>
          </div>
        ) : (
          <p className="transfo-caption">Un día cualquiera en casa de {name}… ¿qué es eso?</p>
        )}
      </div>
    </div>
  );
}
