// Escapadas cortas entre acción y acción, para que la oficina no parezca congelada: mientras
// alguien está «en su mesa», cada cuarto de hora puede levantarse a la impresora, a la fuente,
// a ver el kanban o a comentar algo al de al lado, estirarse o mirar el móvil. Y de vez en
// cuando dos se echan un ping-pong o uno juega a la consola.
//
// Todo por reglas y determinista (mismo resultado en cada tick y tras reiniciar). No gasta IA,
// no va al plan ni al feed (salvo el ping-pong, que se anuncia una vez), y no cambia lo que
// cada uno «oye»: sigue contando como que estaba en el open space.

const { rng } = require('./autopilot');

const SLOT = 15; // minutos

// Lo que puede hacer cada uno por su cuenta, con su peso y su frase.
const SOLO = [
  { kind: 'impresora', w: 2, que: 'Va a por lo que ha imprimido', frases: ['¿Quién ha dejado esto aquí?', 'Atasco de papel. Cómo no.', 'Esto es mío… creo.'] },
  { kind: 'fuente', w: 3, que: 'Rellena el vaso de agua', frases: ['Hay que hidratarse.', 'Glu, glu.', '¿Esta agua sabe rara?'] },
  { kind: 'kanban', w: 2, que: 'Mueve un pósit en el kanban', frases: ['Esto ya está hecho. Más o menos.', '¿Quién ha movido mi tarjeta?', 'En curso… desde marzo.'] },
  { kind: 'visita', w: 3, que: 'Le comenta algo al de al lado', frases: ['Oye, una cosa…', '¿Has visto el correo?', 'Rápido, que no me ven.'] },
  { kind: 'estira', w: 3, que: 'Se estira en la silla', frases: ['Uf, la espalda.', '¿Ya es viernes?', 'Cinco minutos y sigo.'] },
  { kind: 'movil', w: 2, que: 'Mira el móvil «un segundo»', frases: ['Un segundo…', 'Jajaja, mira esto.', 'Nada, nada, ya sigo.'] },
];
const PING = ['¡Saque!', '¡Punto!', '¡Eso ha tocado red!', 'Revancha.', '¡Ese efecto es ilegal!'];
const GAME = ['Una partida y vuelvo.', '¡Récord!', 'Esto es formación, ¿eh?', '¡No me distraigas!'];

const hashId = n => ((n * 2654435761) >>> 0) % SLOT;

function pickWeighted(list, r) {
  const total = list.reduce((s, x) => s + x.w, 0);
  let k = r * total;
  for (const x of list) { k -= x.w; if (k < 0) return x; }
  return list[list.length - 1];
}

// Planes de grupo del cuarto de hora: quién juega al ping-pong y a la consola. Se eligen entre
// los que están ahora en su mesa (eligible: ids ordenados), con una semilla de la empresa y la hora.
function groupPlans(companyId, day, minutes, eligible) {
  const slot = Math.floor(minutes / SLOT);
  const start = slot * SLOT;
  const r = rng(`${companyId}|${day}|${slot}|grupo`);
  const pool = eligible.slice();
  const take = () => pool.splice(Math.floor(r() * pool.length), 1)[0];
  const out = new Map();
  // Ping-pong: 1 de cada 3 cuartos de hora, si hay al menos dos libres. Dura 6-10 minutos.
  if (pool.length >= 2 && r() < 0.34) {
    const from = start + 2 + Math.floor(r() * 3);
    const until = from + 6 + Math.floor(r() * 5);
    const a = take();
    const b = take();
    out.set(a, { kind: 'pingpong', i: 0, con: b, from, until, slot });
    out.set(b, { kind: 'pingpong', i: 1, con: a, from, until, slot });
  }
  // Consola: 1 de cada 4, uno solo o dos a la vez.
  if (pool.length >= 1 && r() < 0.25) {
    const from = start + 1 + Math.floor(r() * 4);
    const until = from + 5 + Math.floor(r() * 6);
    const a = take();
    const b = pool.length && r() < 0.5 ? take() : null;
    out.set(a, { kind: 'consola', i: 0, con: b, from, until, slot });
    if (b) out.set(b, { kind: 'consola', i: 1, con: a, from, until, slot });
  }
  return out;
}

// Escapada de una persona ahora mismo, o null. group: lo que le toca de groupPlans.
const SNACK = { kind: 'maquina', que: 'Asalta la máquina de snacks', frases: ['Tengo un hambre…', 'Venga, máquina, no me falles.', 'Solo una bolsa. Bueno, dos.'] };

function microFor(c, day, minutes, { group, blockFrom, neighbor, hungry = false, noSnack = false }) {
  if (minutes < blockFrom + 10) return null; // nada más llegar, se sienta
  if (group && minutes >= group.from && minutes < group.until) {
    const r = rng(`${c.id}|${day}|${group.slot}|${minutes}`);
    const frases = group.kind === 'pingpong' ? PING : GAME;
    return {
      id: `${group.kind}${group.slot}`, kind: group.kind, spot: [group.kind, group.i], con: group.con,
      lugar: 'descanso', que: group.kind === 'pingpong' ? 'Partida de ping-pong' : 'Una partidita a la consola',
      frase: frases[Math.floor(r() * frases.length)], action: group.kind === 'pingpong' ? 'reunido' : 'holgazaneando',
    };
  }
  const slot = Math.floor((minutes + hashId(c.id)) / SLOT);
  const r = rng(`${c.id}|${day}|${slot}|micro`);
  if (r() > 0.55) return null; // no todos los cuartos de hora
  const at = slot * SLOT - hashId(c.id) + 2 + Math.floor(r() * 5);
  const dur = 3 + Math.floor(r() * 5);
  if (minutes < at || minutes >= at + dur) return null;
  // Con hambre (y lejos de la comida), a la máquina.
  // Con la máquina rota, a la fuente a engañar al estómago.
  let m = hungry && r() < 0.8 ? (noSnack ? { ...SOLO[1], frases: ['La máquina sigue rota…', 'Agua y paciencia.'] } : SNACK) : pickWeighted(SOLO, r());
  if (m.kind === 'visita' && neighbor == null) m = SOLO[0];
  const frase = m.frases[Math.floor(r() * m.frases.length)];
  const base = { id: `${m.kind}${slot}`, kind: m.kind, que: m.que, frase };
  if (m.kind === 'visita') return { ...base, lugar: 'mesa', con: neighbor };
  if (m.kind === 'estira' || m.kind === 'movil') return { ...base, lugar: 'mesa', inPlace: true };
  if (m.kind === 'maquina') return { ...base, lugar: 'cafe', spot: ['maquina', 0], action: 'reunido' };
  return { ...base, lugar: 'mesa', spot: [m.kind, 0], action: m.kind === 'kanban' ? 'pizarra' : 'paseando' };
}

module.exports = { microFor, groupPlans, SLOT };
