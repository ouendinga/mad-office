// La comida, por reglas: cada uno come dentro de la franja de la oficina y los que se llevan bien
// comen juntos (mismo sitio, misma hora). Unos cuantos comen solos. Sin IA.
//
// «Se llevan bien»: mismo equipo (mismo cargo o el mismo jefe) suma, y cada pareja tiene además una
// afinidad fija (no cambia de un día a otro, como en la vida). Los grupos sí cambian cada día.

const { rng } = require('./autopilot');

const PLACES = ['cafe', 'cafe', 'terraza', 'descanso'];
// Aforo para comer (sillas y huecos de verdad; si se llena, a otro sitio o a la mesa).
const CAP = { cafe: 8, terraza: 10, descanso: 4 };
const QUE = {
  descanso: ['Comen en el sofá de la zona chill', 'Comida con la tele puesta'],
  cafe: ['Comen juntos en la cocina', 'Comida de táper en grupo', 'Cola para el micro… y a comer'],
  terraza: ['Comen juntos en la terraza', 'Picnic de oficina en la terraza'],
};
const QUE_SOLO = ['Come de táper', 'Come en la mesa mirando vídeos', 'Calienta el táper en el micro'];

function affinity(a, b) {
  const [x, y] = a.id < b.id ? [a, b] : [b, a];
  let s = rng(`afinidad|${x.id}|${y.id}`)();
  if (x.position_id && x.position_id === y.position_id) s += 0.4;
  if (x.position_parent && x.position_parent === y.position_parent) s += 0.25;
  return s;
}

// chars: los que comen hoy en la oficina. Devuelve Map(id -> { offset, lugar, que, con: [ids] }),
// con offset en minutos desde el inicio de la comida.
// bond(a, b): lo que suman las relaciones de las tramas (aprecio menos roce), si se pasa.
function lunchGroups(chars, day, companyId = 1, bond = null) {
  const r = rng(`comida|${companyId}|${day}`);
  const left = chars.slice().sort((a, b) => a.id - b.id);
  const out = new Map();
  const used = { cafe: 0, terraza: 0, descanso: 0 };
  while (left.length) {
    const a = left.splice(Math.floor(r() * left.length), 1)[0];
    // Un 20 % come solo (o se le olvida).
    if (!left.length || r() < 0.2) {
      const lugar = r() < 0.5 || used.cafe >= CAP.cafe ? 'mesa' : 'cafe';
      if (lugar === 'cafe') used.cafe++;
      out.set(a.id, { offset: Math.floor(r() * 25), lugar, que: lugar === 'mesa' ? 'Come en la mesa mirando vídeos' : QUE_SOLO[0], con: [] });
      continue;
    }
    const size = 1 + Math.floor(r() * 3); // 2-4 personas
    const mates = left.map(b => ({ b, s: affinity(a, b) + (bond ? bond(a.id, b.id) : 0) + r() * 0.3 })).sort((x, y) => y.s - x.s)
      .slice(0, size).filter(x => x.s > 0.45).map(x => x.b);
    for (const b of mates) left.splice(left.indexOf(b), 1);
    const group = [a, ...mates];
    // El sitio que toque, si cabe el grupo; si no, el que tenga hueco; si ninguno, cada uno en su mesa.
    const wanted = PLACES[Math.floor(r() * PLACES.length)];
    const fits = l => used[l] + group.length <= CAP[l];
    const lugar = fits(wanted) ? wanted : ['terraza', 'cafe', 'descanso'].find(fits) || 'mesa';
    if (lugar !== 'mesa') used[lugar] += group.length;
    if (lugar === 'mesa') {
      for (const g of group) out.set(g.id, { offset: Math.floor(r() * 25), lugar, que: 'Come en la mesa mirando vídeos', con: [] });
      continue;
    }
    const offset = Math.floor(r() * 25);
    const que = group.length > 1 ? QUE[lugar][Math.floor(r() * QUE[lugar].length)] : QUE_SOLO[0];
    for (const g of group) out.set(g.id, { offset, lugar, que, con: group.filter(x => x !== g).map(x => x.id) });
  }
  return out;
}

module.exports = { lunchGroups, affinity };
