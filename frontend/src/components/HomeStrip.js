import React, { useEffect, useRef } from 'react';
import { makeCanvas, brush, shade, hash } from '../engine/pixel';
import { characterSprite } from '../engine/Character';
import { drawWindowGlass, seasonOf } from '../canvas/weather';
import { callText } from '../canvas/officeRenderer';

// La tira «En casa»: quien teletrabaja no está en la oficina; se le ve en su casa, en su
// mesa, con el portátil. Si está en una llamada, en la pantalla sale la cara del otro (o un
// auricular y el texto, si es alguien de fuera).

const AW = 80;
const AH = 56;

function minutesOf(clock) {
  const [h, m] = String((clock && clock.hhmm) || '12:00').split(':').map(Number);
  return h * 60 + m;
}

function paintHome(ctx, c, other, env) {
  const b = brush(ctx);
  const wall = ['#E8D5B9', '#CFE0D4', '#D9D2EC', '#F0D3C4', '#D3E3EF'][c.id % 5];
  b.r(0, 0, AW, AH, wall);
  for (let y = 2; y < 34; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < AW; x += 6) b.p(x, y, shade(wall, -14)); // papel pintado
  // ventana con el tiempo
  b.r(50, 5, 24, 20, '#F0E8D8');
  drawWindowGlass(ctx, 52, 7, 20, 16, env);
  b.r(61, 7, 1, 16, '#F0E8D8');
  // suelo
  b.r(0, 36, AW, AH - 36, '#B98A5E');
  for (let x = 0; x < AW; x += 9) b.r(x, 36, 1, AH - 36, '#9C6E44');
  b.r(0, 35, AW, 2, shade(wall, -45));
  // estantería o cuadro, y una planta
  if (hash(c.id, 1) > 0.5) { b.r(8, 8, 22, 3, '#7A4B2C'); for (let i = 0; i < 5; i++) b.r(9 + i * 4, 3, 3, 5, ['#E3584B', '#4E7FB8', '#F2C14E', '#3FAE5A', '#E8ECF2'][i]); }
  else { b.r(10, 6, 16, 12, '#7A4B2C'); b.r(11, 7, 14, 10, '#F6F2EA'); b.r(12, 11, 12, 5, ['#7CC453', '#E85D75', '#4E7FB8'][c.id % 3]); }
  b.r(4, 40, 6, 6, '#C66B3D'); b.r(3, 32, 8, 8, '#3F9C45'); b.p(6, 31, '#62C055');
  // la persona, detrás de la mesa
  ctx.drawImage(characterSprite(c.avatar_config || {}, 'idle'), 24, 12);
  // mesa
  b.r(14, 38, 52, 4, '#DBA673'); b.r(14, 42, 52, 3, '#946236'); b.r(16, 45, 3, 10, '#7A4B2C'); b.r(61, 45, 3, 10, '#7A4B2C');
  // taza humeante y gato (a veces)
  b.r(18, 34, 4, 4, '#F6F2EA'); b.p(22, 35, '#F6F2EA');
  if (hash(c.id, 2) > 0.55) { b.r(66, 48, 9, 5, '#5A4A44'); b.r(72, 45, 4, 4, '#5A4A44'); b.p(72, 44, '#5A4A44'); b.p(75, 44, '#5A4A44'); b.r(64, 47, 2, 1, '#5A4A44'); }
  // portátil a un lado, con la pantalla hacia nosotros: así se ve con quién habla
  b.r(50, 25, 22, 14, '#3B3F52'); b.r(51, 26, 20, 11, c.call ? '#2E8A5A' : '#5A86C4');
  if (c.call && other) {
    ctx.drawImage(characterSprite(other.avatar_config || {}, 'idle'), 6, 2, 20, 14, 53, 26, 16, 11);
  } else if (c.call && c.call.externo) {
    b.r(58, 28, 6, 6, '#F6F2EA'); b.r(59, 30, 4, 3, '#2E8A5A'); // icono de persona
  } else {
    b.r(53, 28, 10, 1, '#FFFFFF'); b.r(53, 31, 14, 1, '#BFD8F2'); b.r(53, 34, 8, 1, '#BFD8F2');
  }
  b.r(48, 39, 26, 1, '#8D97A8');
  if (c.call && c.call.externo) { b.r(26, 13, 1, 4, '#2B2F3D'); b.r(25, 16, 3, 3, '#2B2F3D'); } // auricular
}

function HomeWindow({ c, world }) {
  const ref = useRef(null);
  const art = useRef(null);
  useEffect(() => {
    let raf;
    let last = 0;
    const draw = now => {
      if (now - last > 120) {
        last = now;
        if (!art.current) art.current = makeCanvas(AW, AH);
        const clock = world.clock || {};
        const env = { w: clock.weather, season: clock.season || seasonOf(clock.date), minutes: minutesOf(clock), now };
        const other = c.call && c.call.with ? world.characters.find(x => x.id === c.call.with) : null;
        paintHome(art.current.ctx, c, other, env);
        const cv = ref.current;
        if (cv) {
          const ctx = cv.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(art.current.canvas, 0, 0, cv.width, cv.height);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [c, world]);
  const ct = callText(c, world);
  return (
    <figure className="home-window" title={c.que || ''}>
      <canvas ref={ref} width={AW * 2} height={AH * 2} />
      <figcaption>
        <strong>{c.name}</strong>
        <span>{ct || c.que || 'Teletrabajando'}</span>
      </figcaption>
    </figure>
  );
}

export default function HomeStrip({ world }) {
  if (!world) return null;
  const remotes = world.characters.filter(c => c.mode === 'remoto');
  if (!remotes.length) return null;
  return (
    <div className="home-strip" aria-label="Teletrabajando desde casa">
      <div className="home-strip-title">🏠 Desde casa</div>
      <div className="home-strip-list">
        {remotes.map(c => <HomeWindow key={c.id} c={c} world={world} />)}
      </div>
    </div>
  );
}
