/**
 * El tiempo en el dibujo: a partir de clock.weather (código WMO de Open-Meteo, temperatura y
 * viento) decide qué se ve fuera (terraza, calle) y por las ventanas. Todo determinista por
 * tiempo: las partículas no se guardan, se calculan de `now`.
 */

import { hash } from '../engine/pixel';

// Código WMO → tipo de tiempo que sabemos dibujar.
export function weatherKind(w) {
  if (!w || w.code == null) return 'clear';
  const c = Number(w.code);
  if (c === 0 || c === 1) return 'clear';
  if (c === 2) return 'partly';
  if (c === 3) return 'cloudy';
  if (c === 45 || c === 48) return 'fog';
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return c >= 65 || c === 82 ? 'heavyrain' : 'rain';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
  if (c >= 95) return 'storm';
  return 'cloudy';
}

export function isWindy(w) {
  return !!w && Number(w.wind) >= 28;
}

export function isHot(w) {
  return !!w && Number(w.temp) >= 28 && ['clear', 'partly'].includes(weatherKind(w));
}

export function isCold(w) {
  return !!w && Number(w.temp) <= 4;
}

// Texto e icono para la tarjeta del día.
export function weatherLabel(w) {
  const k = weatherKind(w);
  const map = {
    clear: ['☀️', 'Despejado'], partly: ['🌤️', 'Algo nuboso'], cloudy: ['☁️', 'Nublado'], fog: ['🌫️', 'Niebla'],
    rain: ['🌧️', 'Lluvia'], heavyrain: ['🌧️', 'Llueve fuerte'], snow: ['❄️', 'Nieve'], storm: ['⛈️', 'Tormenta'],
  };
  const [icon, label] = map[k];
  if (isHot(w)) return ['🥵', `${label}, calor`];
  return [icon, label];
}

// Color del cielo según la hora (minutos del día), la estación y el tiempo.
export function skyColors(minutes, season, kind) {
  // Hora a la que anochece aprox. en España según la estación.
  const dusk = { invierno: 1080, primavera: 1230, verano: 1290, otono: 1140 }[season] || 1170;
  const dawn = { invierno: 500, primavera: 450, verano: 420, otono: 480 }[season] || 460;
  let top;
  let bottom;
  if (minutes < dawn - 30 || minutes > dusk + 40) { top = '#141A3A'; bottom = '#2B2F5E'; }
  else if (minutes < dawn + 40) { top = '#4A5A9A'; bottom = '#F2A07A'; }
  else if (minutes > dusk - 40) { top = '#3E3F7A'; bottom = '#F08A5D'; }
  else { top = '#5FA8E8'; bottom = '#BFE6FA'; }
  const grey = { cloudy: 0.55, fog: 0.7, rain: 0.6, heavyrain: 0.75, snow: 0.5, storm: 0.8, partly: 0.2 }[kind] || 0;
  return { top, bottom, grey, dark: minutes < dawn - 30 || minutes > dusk + 40 };
}

// Partículas de lluvia, nieve y niebla sobre un rectángulo (px de arte).
export function drawPrecip(ctx, rect, kind, now, { wind = 0, density = 1 } = {}) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const slant = Math.max(-0.8, Math.min(0.8, wind / 45));
  if (kind === 'rain' || kind === 'heavyrain' || kind === 'storm') {
    const n = Math.round((w * h) / (kind === 'rain' ? 260 : 130) * density);
    ctx.fillStyle = 'rgba(190,215,255,0.75)';
    for (let i = 0; i < n; i++) {
      const speed = 0.22 + hash(i, 1) * 0.1;
      const px = x + ((hash(i, 2) * w + now * speed * slant) % w + w) % w;
      const py = y + ((hash(i, 3) * h + now * speed) % h);
      for (let k = 0; k < 4; k++) ctx.fillRect(Math.round(px - slant * k), Math.round(py - k), 1, 1);
    }
    // charcos que salpican
    ctx.fillStyle = 'rgba(220,235,255,0.5)';
    for (let i = 0; i < n / 6; i++) {
      const t = (now / 400 + hash(i, 4) * 10) % 1;
      if (t > 0.3) continue;
      ctx.fillRect(Math.round(x + hash(i, 5) * w), Math.round(y + hash(i, 6) * h), 2, 1);
    }
  } else if (kind === 'snow') {
    const n = Math.round((w * h) / 200 * density);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (let i = 0; i < n; i++) {
      const speed = 0.012 + hash(i, 7) * 0.012;
      const sway = Math.sin(now / 700 + i) * 3;
      const px = x + ((hash(i, 8) * w + sway + now * speed * slant * 2) % w + w) % w;
      const py = y + ((hash(i, 9) * h + now * speed) % h);
      const s = hash(i, 10) > 0.75 ? 2 : 1;
      ctx.fillRect(Math.round(px), Math.round(py), s, s);
    }
  }
  if (kind === 'fog') {
    for (let i = 0; i < 4; i++) {
      const band = y + ((i * h) / 4 + Math.sin(now / 3000 + i) * 6);
      const g = ctx.createLinearGradient(0, band, 0, band + h / 3);
      g.addColorStop(0, 'rgba(230,232,236,0)');
      g.addColorStop(0.5, 'rgba(230,232,236,0.38)');
      g.addColorStop(1, 'rgba(230,232,236,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, band, w, h / 3);
    }
  }
  ctx.restore();
}

// Tinte general de un exterior: gris si está cubierto, cálido si hace calor, flash de tormenta.
export function drawOutdoorTint(ctx, rect, w, now) {
  const kind = weatherKind(w);
  const { x, y, w: rw, h } = rect;
  const grey = { cloudy: 0.12, fog: 0.2, rain: 0.2, heavyrain: 0.28, snow: 0.08, storm: 0.32 }[kind] || 0;
  if (grey) { ctx.fillStyle = `rgba(70,80,100,${grey})`; ctx.fillRect(x, y, rw, h); }
  if (kind === 'snow') {
    // nieve acumulada: manto blanco con huecos
    ctx.fillStyle = 'rgba(245,250,255,0.35)';
    ctx.fillRect(x, y, rw, h);
  }
  if (isHot(w)) {
    ctx.fillStyle = 'rgba(255,190,90,0.13)';
    ctx.fillRect(x, y, rw, h);
    // reverbero: líneas finas que ondulan
    ctx.fillStyle = 'rgba(255,240,200,0.18)';
    for (let i = 0; i < 6; i++) {
      const yy = y + ((i * h) / 6 + now / 90) % h;
      for (let xx = x; xx < x + rw; xx += 3) ctx.fillRect(xx, Math.round(yy + Math.sin(xx / 5 + now / 300) * 1.5), 2, 1);
    }
  }
  if (kind === 'storm' && (Math.floor(now / 97) % 61 === 0 || Math.floor(now / 89) % 79 === 0)) {
    ctx.fillStyle = 'rgba(235,240,255,0.55)';
    ctx.fillRect(x, y, rw, h);
  }
}

// El cristal de una ventana: cielo de la hora, nubes y lo que caiga.
export function drawWindowGlass(ctx, gx, gy, gw, gh, { w, season, minutes, now }) {
  const kind = weatherKind(w);
  const sky = skyColors(minutes, season, kind);
  const g = ctx.createLinearGradient(0, gy, 0, gy + gh);
  g.addColorStop(0, sky.top);
  g.addColorStop(1, sky.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(gx, gy, gw, gh);
  if (sky.grey) { ctx.fillStyle = `rgba(150,158,172,${sky.grey * 0.8})`; ctx.fillRect(gx, gy, gw, gh); }
  if (!sky.dark && ['clear', 'partly'].includes(kind)) {
    ctx.fillStyle = isHot(w) ? '#FFE27A' : '#FFF4C2';
    ctx.fillRect(gx + gw - 5, gy + 1, 3, 3);
  }
  if (['partly', 'cloudy'].includes(kind)) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    const off = Math.floor(now / 1500) % (gw + 8);
    ctx.fillRect(gx + ((off) % gw), gy + 2, 6, 2);
    ctx.fillRect(gx + ((off + 9) % gw), gy + 4, 4, 1);
  }
  // casas al fondo, con luces si es de noche
  ctx.fillStyle = sky.dark ? '#2A2D4A' : 'rgba(110,120,150,0.55)';
  ctx.fillRect(gx, gy + gh - 3, gw, 3);
  if (sky.dark) { ctx.fillStyle = '#FFD98A'; for (let i = 1; i < gw; i += 4) if (hash(i, gx, 3) > 0.5) ctx.fillRect(gx + i, gy + gh - 2, 1, 1); }
  drawPrecip(ctx, { x: gx, y: gy, w: gw, h: gh }, kind, now, { wind: w ? w.wind : 0, density: 1.4 });
  if (kind === 'snow') { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(gx, gy + gh - 1, gw, 1); }
  // gotas en el cristal
  if (['rain', 'heavyrain', 'storm'].includes(kind)) {
    ctx.fillStyle = 'rgba(230,240,255,0.7)';
    for (let i = 0; i < gw / 3; i++) {
      const dy = (now / (900 + hash(i, gx, 1) * 900) + hash(i, gx, 2)) % 1;
      ctx.fillRect(gx + Math.floor(hash(i, gx, 3) * gw), gy + Math.floor(dy * gh), 1, 2);
    }
  }
}

// Estación a partir de la fecha (hemisferio norte), por si el servidor no la manda.
export function seasonOf(date) {
  const m = Number(String(date || '').slice(5, 7)) || (new Date().getMonth() + 1);
  const d = Number(String(date || '').slice(8, 10)) || 1;
  const md = m * 100 + d;
  if (md >= 321 && md < 621) return 'primavera';
  if (md >= 621 && md < 923) return 'verano';
  if (md >= 923 && md < 1221) return 'otono';
  return 'invierno';
}
