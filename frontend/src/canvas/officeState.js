// Cómo se ve el estado de la oficina (world.office): los incidentes abiertos (máquina rota, olor en
// la cocina, pósits por el suelo, baño inundado, apagón…) y los eventos en marcha (afterwork,
// taller…). Dos capas: lo que se pinta en el arte (charcos, olor, papeles) y los carteles, que van
// en la pantalla para que se lean.

import officeMap from '../assets/maps/office.json';

const T = 16;
export const PLACE_ROOM = {
  cafe: 'cocina', mesa: 'openspace', lavabo: 'banos', descanso: 'descanso', terraza: 'terraza',
  reuniones: 'reuniones', recepcion: 'recepcion', despacho: 'despacho', servidores: 'servidores',
};
const room = id => officeMap.rooms.find(r => r.id === id);
const obj = type => officeMap.objects.find(o => o.type === type);
const has = (office, kind) => !!(office && office.incidents.some(i => i.kind === kind));

// Qué objeto lleva el cartel de cada incidente.
const SIGN_ON = {
  maquina_rota: 'vending', cafetera_rota: 'kitchen_counter', sin_cafe: 'kitchen_counter',
  impresora_atasco: 'printer', aire_roto: 'ac_unit', postits_viento: 'kanban', postits_movidos: 'kanban',
};
const SIGN_TEXT = { aire_roto: 'ROTO', postits_viento: 'SIN PÓSITS', postits_movidos: '¿QUIÉN HA TOCADO ESTO?' };
const POSTIT = ['#FFE066', '#7FD1AE', '#F7A8C8', '#8EC5FF'];

// Capa de arte (antes de la noche y del tiempo): en píxeles de arte.
export function drawStateArt(ctx, office, now) {
  if (!office) return;
  // Pósits por el suelo alrededor del kanban (y el tablero vacío).
  if (has(office, 'postits_viento')) {
    const k = obj('kanban');
    if (k) {
      ctx.fillStyle = '#F7F7F2';
      ctx.fillRect(k.x * T + 3, k.y * T - 9, (k.w || 1) * T - 6, 9);
      for (let i = 0; i < 9; i++) {
        const x = k.x * T - 10 + ((i * 37) % 52);
        const y = k.y * T + 18 + ((i * 23) % 26);
        ctx.fillStyle = POSTIT[i % 4];
        ctx.fillRect(x, y, 4, 3);
      }
    }
  }
  // Impresora atascada: folio arrugado asomando y luz naranja que parpadea.
  if (has(office, 'impresora_atasco')) {
    const p = obj('printer');
    if (p) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(p.x * T + 4, p.y * T - 6, 8, 6);
      ctx.fillStyle = '#C9C4BA';
      ctx.fillRect(p.x * T + 6, p.y * T - 4, 4, 1);
      if (Math.floor(now / 400) % 2 === 0) { ctx.fillStyle = '#FF9F1A'; ctx.fillRect(p.x * T + 12, p.y * T + 2, 2, 2); }
    }
  }
  // Máquina rota: pantalla apagada y una cinta en diagonal.
  if (has(office, 'maquina_rota')) {
    const v = obj('vending');
    if (v) {
      ctx.fillStyle = '#E74C3C';
      for (let i = 0; i < 14; i++) ctx.fillRect(v.x * T + 1 + i, v.y * T - 8 + i, 2, 2);
    }
  }
  // Olor en la cocina: nubecillas verdes que suben.
  if (has(office, 'olor_micro')) {
    const r = room('cocina');
    if (r) {
      for (let i = 0; i < 10; i++) {
        const t = (now / 1800 + i * 0.37) % 1;
        const x = (r.x + 1 + ((i * 53) % (r.w - 2))) * T + Math.sin(now / 500 + i) * 4;
        const y = (r.y + r.h) * T - t * r.h * T;
        ctx.globalAlpha = 0.45 * (1 - t);
        ctx.fillStyle = '#8BC34A';
        ctx.fillRect(Math.round(x), Math.round(y), 6, 3);
        ctx.fillRect(Math.round(x) + 2, Math.round(y) - 2, 4, 2);
      }
      ctx.globalAlpha = 1;
    }
  }
  // Baño inundado: charco azul por el suelo.
  if (has(office, 'bano_inundado')) {
    const r = room('banos');
    if (r) {
      ctx.globalAlpha = 0.35 + Math.sin(now / 700) * 0.05;
      ctx.fillStyle = '#3E8ED0';
      ctx.fillRect(r.x * T, (r.y + 1) * T, r.w * T, (r.h - 1) * T);
      ctx.globalAlpha = 1;
      // reflejos
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 6; i++) ctx.fillRect(r.x * T + ((i * 13 + Math.floor(now / 300)) % (r.w * T - 4)), (r.y + 2 + i) * T, 4, 1);
    }
  }
  // Calor: el open space se tiñe de naranja.
  if (has(office, 'aire_roto')) {
    const r = room('openspace');
    if (r) {
      ctx.fillStyle = `rgba(255, 120, 40, ${0.08 + Math.sin(now / 900) * 0.03})`;
      ctx.fillRect(r.x * T, r.y * T, r.w * T, r.h * T);
    }
  }
  // Eventos en marcha: guirnalda de colores en lo alto de la sala.
  for (const ev of office.events || []) {
    if (!ev.active) continue;
    const r = room(PLACE_ROOM[ev.place]);
    if (!r) continue;
    const y = (r.y + 1) * T + 2;
    for (let x = r.x * T + 4; x < (r.x + r.w) * T - 4; x += 6) {
      ctx.fillStyle = POSTIT[(x / 6 + Math.floor(now / 500)) % 4 | 0];
      ctx.fillRect(x, y + (Math.floor(x / 6) % 2), 3, 3);
    }
  }
}

// Apagón: todo a oscuras (encima de todo, con un parpadeo de vez en cuando).
export function drawBlackout(ctx, office, now, w, h) {
  if (!has(office, 'apagon')) return;
  const flicker = Math.floor(now / 120) % 37 === 0 ? 0.35 : 0.72;
  ctx.fillStyle = `rgba(8, 10, 24, ${flicker})`;
  ctx.fillRect(0, 0, w, h);
}

// Carteles en pantalla. S(x, y) pasa de píxeles de arte a pantalla; pill pinta una etiqueta.
export function drawStateSigns(ctx, office, S, pill) {
  if (!office) return;
  for (const inc of office.incidents) {
    let at = null;
    let text = inc.sign || SIGN_TEXT[inc.kind];
    if (SIGN_ON[inc.kind]) {
      const o = obj(SIGN_ON[inc.kind]);
      if (o) at = [(o.x + (o.w || 1) / 2) * T, o.y * T - 10];
    } else if (inc.kind === 'bano_inundado') {
      const r = room('banos');
      at = [(r.x + r.w / 2) * T, (r.y + 2) * T];
    } else if (inc.kind === 'olor_micro') {
      const r = room('cocina');
      at = [(r.x + r.w / 2) * T, (r.y + r.h - 1) * T];
      text = '¡QUÉ PESTE!';
    } else if (inc.kind === 'apagon') {
      at = [officeMap.cols * T / 2, 6 * T];
      text = 'APAGÓN';
    }
    if (!at || !text) continue;
    const [x, y] = S(at[0], at[1]);
    pill(ctx, `⚠ ${text}`, x, y, { font: '800 10px Inter, sans-serif', bg: 'rgba(214, 48, 49, 0.92)' });
  }
  for (const ev of office.events || []) {
    if (!ev.active) continue;
    const r = room(PLACE_ROOM[ev.place]);
    if (!r) continue;
    const [x, y] = S((r.x + r.w / 2) * T, (r.y + 1) * T + 10);
    pill(ctx, `🎉 ${ev.title}`, x, y, { font: '800 10px Inter, sans-serif', bg: 'rgba(108, 92, 231, 0.95)' });
  }
}
