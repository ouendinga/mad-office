// Tramas: historias de oficina que se encadenan, por REGLAS (sin IA). Causa y consecuencia:
//   - un incidente puede arrancar una trama (los pósits movidos → la guerra de los pósits);
//   - cada paso de una trama decide el siguiente según quién está, cómo es cada uno y cómo se llevan
//     (efecto mariposa: si el testigo no está en la cocina, culpan al que no era, y ese rencor sigue);
//   - una trama puede provocar incidentes (la guerra del termostato rompe el aire) y otras tramas;
//   - todo deja roces y simpatías entre personas (relaciones), que cambian con quién comen, a quién
//     le toca la broma pesada y de qué se cotillea.
//
// Cada paso deja una línea en el feed (kind 'trama', con su sitio: la oyen los que están allí, y los
// personajes con IA reaccionan a lo que oyen) y, si toca, una ESCENA: los del reparto van a un sitio
// a hacer algo durante unos minutos, y se ve en el mapa.
//
// Para añadir una trama: una entrada en PLOTS con su reparto (`roles`), cuándo puede empezar sola
// (`when` + `weight`) y sus pasos. Un paso recibe (P, x) y devuelve lo que pasa (ver `beat`).

const { rng } = require('./autopilot');
const { traits } = require('./incidents');

const MAX_ACTIVE = 3; // tramas a la vez por oficina
const MAX_NEW_PER_DAY = 3; // que empiecen solas, al día
const START_PER_HOUR = 0.14; // probabilidad por hora de oficina de que empiece una sola
const MAX_WAITS = 3; // si falta alguien del reparto, se espera; a la tercera, otro final
const REL_DECAY = { roce: 0.9, aprecio: 0.95 }; // cada día se olvida un poco

const nm = c => (c ? c.name : 'alguien');
const between = (r, [a, b]) => a + Math.floor(r() * (b - a + 1));
const pick = (r, list) => (list.length ? list[Math.floor(r() * list.length)] : null);

// Lo que devuelve un paso. Todo opcional.
//   line: texto del feed · by/con: quién lo protagoniza · lugar: dónde (para quién lo oye)
//   scenes: [{ c, lugar, que, frase, con, min }] · rel: [[de, a, roce, aprecio]] · stats: [[c, {…}]]
//   incident: { kind, cause, victim } · spawn: { kind, cast } · cast: { rol: personaje }
//   state: {…} · next: [paso, [min, max]] · end: 'final'
const beat = o => o;

// --- Rumores: cada vez que pasa de boca en boca, cambia un poco ---
const RUMORS = [
  ['van a cambiar las sillas', 'van a quitar las sillas', 'vamos a trabajar de pie', 'van a poner cintas de correr en las mesas', 'la empresa se apunta a una maratón'],
  ['va a venir alguien de arriba', 'viene el dueño en persona', 'el dueño viene a revisar los gastos de pósits', 'el dueño quiere ver a todo el mundo en la sala de reuniones'],
  ['van a cambiar la cafetera', 'van a quitar la cafetera', 'el café va a ser de pago', 'el café solo los viernes'],
  ['este año hay cena de empresa', 'la cena es con barra libre', 'la cena es en un barco', 'nos llevan a todos de viaje a Japón'],
  ['van a pintar la oficina', 'van a pintar la oficina de naranja', 'la oficina va a ser de colores, como las de Google', 'nos van a poner un tobogán'],
];

// --- El catálogo ---

const PLOTS = {
  guerra_postits: {
    icon: '📌', title: P => `La guerra de los pósits: ${nm(P.c.victima)} contra ${nm(P.c.atacante)}`,
    gossip: P => `lo de ${nm(P.c.victima)} y ${nm(P.c.atacante)} con los pósits`,
    roles: ['atacante', 'victima'],
    needs: ['kanban'],
    // Sola: entre dos que ya se tienen ganas (o alguien con mala leche).
    when: x => {
      const pair = x.worstPair();
      if (pair && pair.roce >= 0.4) return { atacante: pair.a, victima: pair.b };
      const a = pick(x.r, x.here.filter(c => x.traits(c).malaLeche));
      const b = a && pick(x.r, x.here.filter(c => c.id !== a.id));
      return a && b ? { atacante: a, victima: b } : null;
    },
    weight: 1,
    first: 'descubre',
    steps: {
      descubre: (P, x) => beat({
        need: ['victima'],
        by: P.c.victima, con: P.c.atacante, lugar: 'mesa',
        line: `🕵️ ${nm(P.c.victima)} descubre que alguien le ha movido los pósits a «Bloqueado». Mira fijamente a ${nm(P.c.atacante)}.`,
        scenes: [{ c: P.c.victima, lugar: 'mesa', que: 'Recoloca sus pósits uno a uno', frase: '¿Quién ha tocado mis pósits?', min: 15 }],
        rel: [[P.c.victima, P.c.atacante, 0.3, 0]],
        state: { objetivo: P.ids.atacante, autor: P.ids.victima, asalto: 1 },
        next: ['venganza', [30, 110]],
      }),
      venganza: (P, x) => {
        const autor = x.byId(P.state.autor);
        const obj = x.byId(P.state.objetivo);
        if (!x.present(autor)) return beat({ wait: true });
        const dura = x.traits(autor).malaLeche || x.rel(autor, obj).roce > 0.6 || x.r() < 0.5;
        if (dura) {
          return beat({
            by: autor, con: obj, lugar: 'mesa',
            line: `☕ ${nm(autor)} esconde la taza de ${nm(obj)} en el cajón de los cables. Silbando.`,
            scenes: [{ c: autor, lugar: 'mesa', con: obj, que: `Pasa «por casualidad» por la mesa de ${nm(obj)}`, frase: 'Nada, aquí pasaba.', min: 10 }],
            next: ['busca_taza', [20, 70]],
          });
        }
        return beat({
          by: autor, con: obj, lugar: 'mesa',
          line: `📝 ${nm(autor)} pega un pósit en la pantalla de ${nm(obj)}: «Mis tareas, mis columnas. Gracias :)».`,
          scenes: [{ c: autor, lugar: 'mesa', con: obj, que: 'Deja un pósit en una pantalla ajena', frase: 'Gracias :)', min: 8 }],
          rel: [[obj, autor, 0.2, 0]],
          state: { objetivo: P.state.autor, autor: P.state.objetivo, asalto: P.state.asalto + 1 },
          next: [P.state.asalto >= 3 ? 'paz' : 'venganza', [40, 120]],
        });
      },
      busca_taza: (P, x) => {
        const victima = x.byId(P.state.objetivo);
        const autor = x.byId(P.state.autor);
        if (!x.present(victima)) return beat({ wait: true });
        const testigo = pick(x.r, x.inRoom(victima, 'cafe').filter(c => c.id !== autor.id && c.id !== victima.id));
        const base = { by: victima, lugar: 'cafe', scenes: [{ c: victima, lugar: 'cafe', que: 'Busca su taza por toda la cocina', frase: '¿Alguien ha visto mi taza?', min: 12 }] };
        if (testigo && x.r() < 0.7) {
          return beat({
            ...base, con: testigo,
            line: `👀 ${nm(testigo)} le chiva a ${nm(victima)} que vio a ${nm(autor)} rondando su mesa. La taza aparece en el cajón de los cables.`,
            rel: [[victima, autor, 0.35, 0], [victima, testigo, 0, 0.2], [autor, testigo, 0.2, 0]],
            state: { objetivo: P.state.autor, autor: P.state.objetivo, asalto: P.state.asalto + 1 },
            next: [P.state.asalto + 1 >= 3 ? 'paz' : 'venganza', [30, 100]],
          });
        }
        // Nadie lo vio: culpa al que no es. Ese rencor ya no se va.
        const inocente = pick(x.r, x.here.filter(c => c.id !== autor.id && c.id !== victima.id));
        if (!inocente) return beat({ ...base, line: `🫖 ${nm(victima)} da su taza por perdida y bebe en un vaso de plástico, con dignidad.`, end: 'perdida' });
        return beat({
          ...base, con: inocente,
          line: `🤨 ${nm(victima)} está convencido de que la taza la escondió ${nm(inocente)}. ${nm(inocente)} no sabe de qué le hablan.`,
          rel: [[victima, inocente, 0.35, 0], [inocente, victima, 0.25, 0]],
          cast: { inocente },
          state: { objetivo: inocente.id, autor: victima.id, asalto: P.state.asalto + 1, equivocado: true },
          next: [P.state.asalto + 1 >= 3 ? 'paz' : 'venganza', [30, 100]],
        });
      },
      paz: (P, x) => {
        const a = x.byId(P.ids.atacante);
        const v = x.byId(P.ids.victima);
        const jefe = x.boss(v) || x.boss(a);
        const coletilla = P.cast.inocente ? ` ${nm(P.cast.inocente)} sigue sin saber por qué le miran mal.` : '';
        if (jefe && x.present(jefe) && x.r() < 0.6) {
          return beat({
            need: ['atacante', 'victima'],
            by: jefe, con: v, lugar: 'despacho',
            line: `👔 ${nm(jefe)} reúne a ${nm(a)} y ${nm(v)} en el despacho: «Aquí no se tocan los pósits de nadie. Ni las tazas».${coletilla}`,
            scenes: [{ c: a, lugar: 'despacho', que: 'Bronca en el despacho', frase: 'Ha empezado él.', min: 15 },
              { c: v, lugar: 'despacho', que: 'Bronca en el despacho', frase: '¡Ha empezado él!', min: 15 }],
            rel: [[a, v, -0.4, 0], [v, a, -0.4, 0], [a, jefe, 0.1, 0], [v, jefe, 0.1, 0]],
            end: 'jefe',
          });
        }
        return beat({
          need: ['atacante', 'victima'],
          by: a, con: v, lugar: 'cafe',
          line: `🤝 ${nm(a)} y ${nm(v)} firman la paz con un café de máquina. Cada uno paga el suyo.${coletilla}`,
          scenes: [{ c: a, lugar: 'cafe', con: v, que: 'Café de la paz', frase: 'Tablas.', min: 12 }, { c: v, lugar: 'cafe', con: a, que: 'Café de la paz', frase: 'Tablas. Por ahora.', min: 12 }],
          rel: [[a, v, -0.35, 0.15], [v, a, -0.35, 0.15]],
          end: 'tregua',
        });
      },
    },
  },

  taper_misterioso: {
    icon: '🥡', title: P => `El táper desaparecido de ${nm(P.c.dueno)}`,
    gossip: P => `lo del táper de ${nm(P.c.dueno)}`,
    roles: ['dueno', 'culpable'],
    needs: ['fridge'],
    when: x => {
      if (!x.lunch) return null;
      const dueno = pick(x.r, x.here);
      if (!dueno) return null;
      const rest = x.here.filter(c => c.id !== dueno.id);
      const culpable = pick(x.r, rest.filter(c => x.traits(c).torpe || x.traits(c).malaLeche)) || pick(x.r, rest);
      return culpable ? { dueno, culpable } : null;
    },
    weight: 1,
    first: 'desaparece',
    steps: {
      desaparece: (P, x) => beat({
        need: ['dueno'],
        by: P.c.dueno, lugar: 'cafe',
        line: `🥡 El táper de ${nm(P.c.dueno)} ha desaparecido de la nevera. Solo queda la tapa.`,
        scenes: [{ c: P.c.dueno, lugar: 'cafe', que: 'Mira la nevera sin creérselo', frase: '¿¿Mi táper??', min: 10 }],
        stats: [[P.c.dueno, { animo: -0.3, saciedad: -0.3 }]],
        next: ['investiga', [8, 25]],
      }),
      investiga: (P, x) => {
        const d = x.byId(P.ids.dueno);
        if (!x.present(d)) return beat({ wait: true });
        const culpable = x.byId(P.ids.culpable);
        const pool = x.here.filter(c => c.id !== d.id);
        // Sospecha de a quien ya le tiene manía; si no, del que pasaba por ahí.
        const sospechoso = pool.slice().sort((a, b) => x.rel(d, b).roce - x.rel(d, a).roce)[0];
        const acierta = sospechoso && culpable && sospechoso.id === culpable.id ? x.r() < 0.7 : x.r() < 0.25;
        const base = { by: d, lugar: 'cafe', scenes: [{ c: d, lugar: 'cafe', que: 'Interroga a todo el que pasa por la cocina', frase: '¿Tú has abierto la nevera?', min: 15 }] };
        if (acierta && culpable && x.present(culpable)) return beat({ ...base, line: `🔎 ${nm(d)} interroga a media oficina. Las pistas llevan a ${nm(culpable)}.`, next: ['confiesa', [5, 20]] });
        const acusado = sospechoso && (!culpable || sospechoso.id !== culpable.id) ? sospechoso : pick(x.r, pool.filter(c => !culpable || c.id !== culpable.id));
        if (!acusado) return beat({ ...base, line: `🔎 ${nm(d)} interroga a la nevera. La nevera no habla.`, next: ['nota', [30, 90]] });
        return beat({
          ...base, con: acusado,
          line: `☝️ ${nm(d)} acusa a ${nm(acusado)} delante de toda la cocina. ${nm(acusado)} jura que ha comido ensalada.`,
          rel: [[acusado, d, 0.4, 0], [d, acusado, 0.3, 0]],
          cast: { acusado },
          next: ['nota', [30, 120]],
        });
      },
      confiesa: (P, x) => {
        const d = x.byId(P.ids.dueno);
        const k = x.byId(P.ids.culpable);
        if (x.traits(k).torpe || x.r() < 0.4) {
          return beat({
            need: ['culpable'], by: k, con: d, lugar: 'cafe',
            line: `😳 ${nm(k)} confiesa: «Pensaba que era el mío. Tenemos el mismo táper». Mañana trae comida para dos.`,
            scenes: [{ c: k, lugar: 'cafe', con: d, que: 'Pide perdón por el táper', frase: '¡Es que son iguales!', min: 10 }],
            rel: [[d, k, 0.1, 0.1]],
            end: 'confesion',
          });
        }
        return beat({
          need: ['culpable'], by: k, con: d, lugar: 'cafe',
          line: `😈 ${nm(k)} se limpia la boca: «Estaban buenísimas». ${nm(d)} no se lo va a perdonar.`,
          scenes: [{ c: k, lugar: 'cafe', con: d, que: 'Ni lo niega', frase: 'Estaban buenísimas.', min: 8 }],
          rel: [[d, k, 0.6, 0]],
          // Y de aquí, guerra (efecto mariposa).
          spawn: x.r() < 0.6 ? { kind: 'guerra_postits', cast: { atacante: d, victima: k } } : null,
          end: 'descarado',
        });
      },
      nota: (P, x) => {
        const d = x.byId(P.ids.dueno);
        if (!x.present(d)) return beat({ wait: true });
        const quien = P.cast.acusado;
        return beat({
          by: d, lugar: 'cafe',
          line: `📝 Aparece una nota en la nevera: «A quien se comió el táper de ${nm(d)}: SÉ QUIÉN ERES».${quien ? ` ${nm(quien)} la lee y se va muy digno.` : ''}`,
          scenes: [{ c: d, lugar: 'cafe', que: 'Pega una nota en la nevera', frase: 'Que quede claro.', min: 6 }],
          spawn: quien && x.rel(quien, d).roce > 0.5 && x.r() < 0.4 ? { kind: 'guerra_postits', cast: { atacante: quien, victima: d } } : null,
          end: 'sin_resolver',
        });
      },
    },
  },

  apuesta_pingpong: {
    icon: '🏓', title: P => `La apuesta del ping-pong: ${nm(P.c.retador)} contra ${nm(P.c.rival)}`,
    gossip: P => `la final de ping-pong de ${nm(P.c.retador)} y ${nm(P.c.rival)}`,
    roles: ['retador', 'rival'],
    needs: ['pingpong'],
    when: x => {
      const a = pick(x.r, x.here);
      const b = a && pick(x.r, x.here.filter(c => c.id !== a.id));
      return b ? { retador: a, rival: b } : null;
    },
    weight: 1,
    first: 'reto',
    steps: {
      reto: (P, x) => beat({
        need: ['retador', 'rival'], by: P.c.retador, con: P.c.rival, lugar: 'cafe',
        line: `🏓 ${nm(P.c.retador)} reta a ${nm(P.c.rival)} al ping-pong: quien pierda trae cruasanes para toda la oficina.`,
        scenes: [{ c: P.c.retador, lugar: 'cafe', con: P.c.rival, que: 'Lanza un reto', frase: 'Tú y yo. Al ping-pong.', min: 8 }],
        next: ['entreno', [50, 150]],
      }),
      entreno: (P, x) => {
        const quien = pick(x.r, [P.c.retador, P.c.rival].filter(c => x.present(c)));
        if (!quien) return beat({ wait: true });
        return beat({
          by: quien, lugar: 'descanso',
          line: `💪 ${nm(quien)} entrena en secreto saques contra la pared. Se oye desde recepción.`,
          scenes: [{ c: quien, lugar: 'descanso', que: 'Entrena saques contra la pared', frase: 'Este saque es imparable.', min: 15 }],
          state: { entrena: quien.id },
          next: ['final', [50, 160]],
        });
      },
      final: (P, x) => {
        const a = P.c.retador;
        const b = P.c.rival;
        const publico = x.here.filter(c => c.id !== a.id && c.id !== b.id).slice(0, 5);
        const bonus = id => (P.state.entrena === id ? 0.2 : 0);
        const ganaA = x.r() + bonus(a.id) > 0.5 + bonus(b.id);
        const [w, l] = ganaA ? [a, b] : [b, a];
        const sorpresa = P.state.entrena === l.id ? ' Tanto entrenar para nada.' : '';
        return beat({
          need: ['retador', 'rival'], by: w, con: l, lugar: 'descanso',
          line: `🏆 ${nm(w)} gana la final de ping-pong a ${nm(l)} 21-19.${sorpresa}${publico.length ? ` ${nm(pick(x.r, publico))} grita «¡tongo!».` : ''}`,
          scenes: [{ c: a, lugar: 'descanso', con: b, que: 'La gran final de ping-pong', frase: '¡Vamos!', min: 20 },
            { c: b, lugar: 'descanso', con: a, que: 'La gran final de ping-pong', frase: '¡Esa no ha botado!', min: 20 },
            ...publico.map(c => ({ c, lugar: 'descanso', que: 'Mira la final de ping-pong', frase: pick(x.r, ['¡Vamos!', '¡Tongo!', 'Esto es mejor que la tele.']), min: 20 }))],
          rel: [[l, w, 0.15, 0.05], [w, l, 0, 0.1]],
          stats: [[w, { animo: 0.5 }], [l, { animo: -0.3 }]],
          state: { ganador: w.id, perdedor: l.id },
          next: ['paga', [90, 240]],
        });
      },
      paga: (P, x) => {
        const l = x.byId(P.state.perdedor);
        if (!x.present(l)) return beat({ wait: true });
        const todos = x.here.filter(c => c.id !== l.id);
        if (x.traits(l).malaLeche && x.r() < 0.5) {
          return beat({
            by: l, lugar: 'cafe',
            line: `🥐 ${nm(l)} paga la apuesta… con cruasanes de ayer. «Nadie dijo que fueran de hoy».`,
            scenes: [{ c: l, lugar: 'cafe', que: 'Deja una bolsa de cruasanes duros', frase: 'Apuesta pagada.', min: 10 }],
            rel: todos.map(c => [c, l, 0.1, 0]),
            end: 'cruasanes_duros',
          });
        }
        return beat({
          by: l, lugar: 'cafe',
          line: `🥐 ${nm(l)} paga la apuesta: cruasanes para toda la oficina. La cocina se llena en diez segundos.`,
          scenes: [{ c: l, lugar: 'cafe', que: 'Reparte cruasanes', frase: 'Apuesta es apuesta.', min: 12 },
            ...todos.filter(() => x.r() < 0.5).map(c => ({ c, lugar: 'cafe', que: 'A por un cruasán', frase: '¡Gracias!', min: 8 }))],
          rel: todos.map(c => [c, l, 0, 0.15]),
          stats: todos.map(c => [c, { animo: 0.2, saciedad: 0.3 }]),
          end: 'cruasanes',
        });
      },
    },
  },

  rumor: {
    icon: '🗣️', title: P => `El rumor: «${RUMORS[P.state.cadena][Math.min(P.state.nivel, RUMORS[P.state.cadena].length - 1)]}»`,
    gossip: P => `que ${RUMORS[P.state.cadena][Math.min(P.state.nivel, RUMORS[P.state.cadena].length - 1)]}`,
    roles: ['origen'],
    needs: [],
    when: x => { const o = pick(x.r, x.here); return o ? { origen: o } : null; },
    init: x => ({ cadena: Math.floor(x.r() * RUMORS.length), nivel: 0, saben: [], pasos: 0 }),
    weight: 1.2,
    first: 'oye',
    steps: {
      oye: (P, x) => beat({
        need: ['origen'], by: P.c.origen, lugar: 'reuniones',
        line: `👂 ${nm(P.c.origen)} oye a medias, al pasar por la sala de reuniones: «…${RUMORS[P.state.cadena][0]}…».`,
        scenes: [{ c: P.c.origen, lugar: 'reuniones', que: 'Pasa muy despacio junto a la sala de reuniones', frase: '¿Cómo?', min: 6 }],
        state: { saben: [P.ids.origen] },
        next: ['propaga', [10, 35]],
      }),
      propaga: (P, x) => {
        const chain = RUMORS[P.state.cadena];
        const saben = new Set(P.state.saben);
        // Pasa de boca en boca entre los que están juntos; si no hay nadie, va a buscar a alguien.
        const quien = pick(x.r, x.here.filter(c => saben.has(c.id)));
        if (!quien) return P.state.pasos > 6 ? beat({ line: `🤷 El rumor de que ${chain[P.state.nivel]} se apaga solo. Nadie se acuerda de quién lo dijo.`, end: 'olvidado' }) : beat({ wait: true });
        const cerca = x.inRoom(quien).filter(c => !saben.has(c.id));
        const a = pick(x.r, cerca.length ? cerca : x.here.filter(c => !saben.has(c.id)));
        if (!a) return beat({ line: `🤷 Ya lo sabe toda la oficina: ${chain[P.state.nivel]}. Nadie sabe de dónde ha salido.`, next: ['desmiente', [10, 40]] });
        const nivel = Math.min(chain.length - 1, P.state.nivel + (x.r() < 0.6 ? 1 : 0));
        const llegaAlJefe = x.isBoss(a);
        return beat({
          by: quien, con: a, lugar: x.where(quien) === 'mesa' ? 'mesa' : x.where(quien),
          line: `🗣️ ${nm(quien)} le cuenta a ${nm(a)} que ${chain[nivel]}.${nivel > P.state.nivel ? ' (No era exactamente eso).' : ''}`,
          scenes: [{ c: quien, lugar: 'mesa', con: a, que: 'Cuenta un secreto en voz baja', frase: '¿Te has enterado?', min: 8 },
            { c: a, lugar: 'mesa', que: 'Escucha un secreto', frase: pick(x.r, ['¿En serio?', '¡No me digas!', 'Ya me lo olía.']), min: 8 }],
          state: { saben: [...saben, a.id], nivel, pasos: P.state.pasos + 1 },
          next: [(llegaAlJefe && P.state.pasos >= 2) || saben.size + 1 >= 6 ? 'desmiente' : 'propaga', [12, 40]],
        });
      },
      desmiente: (P, x) => {
        const chain = RUMORS[P.state.cadena];
        const jefe = pick(x.r, x.here.filter(c => c.csuite)) || pick(x.r, x.here.filter(x.isBoss));
        if (!jefe) return beat({ wait: true });
        if (x.r() < 0.2) {
          return beat({
            by: jefe, lugar: 'mesa',
            line: P.state.nivel > 0
              ? `😮 ${nm(jefe)}: «¿Quién os ha dicho que ${chain[0]}? Era una sorpresa». Era verdad… lo primero. Lo de que ${chain[P.state.nivel]}, no.`
              : `😮 ${nm(jefe)}: «¿Quién os ha dicho que ${chain[0]}? Era una sorpresa». Pues sí, era verdad.`,
            stats: x.here.map(c => [c, { animo: 0.2 }]),
            end: 'era_verdad',
          });
        }
        return beat({
          by: jefe, lugar: 'mesa',
          line: `👔 ${nm(jefe)}, a toda la oficina: «Nadie ha dicho que ${chain[P.state.nivel]}. Volved al trabajo».${P.state.nivel > 1 ? ` Hay quien se queda decepcionado.` : ''}`,
          scenes: [{ c: jefe, lugar: 'mesa', que: 'Desmiente un rumor en voz alta', frase: 'Aquí no pasa nada.', min: 8 }],
          end: 'desmentido',
        });
      },
    },
  },

  termostato: {
    icon: '🌡️', title: P => `La guerra del termostato: ${nm(P.c.friolero)} contra ${nm(P.c.caluroso)}`,
    gossip: P => `la guerra del termostato de ${nm(P.c.friolero)} y ${nm(P.c.caluroso)}`,
    roles: ['friolero', 'caluroso'],
    needs: ['ac_unit'],
    when: x => {
      const f = pick(x.r, x.here);
      const c = f && pick(x.r, x.here.filter(y => y.id !== f.id));
      return c ? { friolero: f, caluroso: c } : null;
    },
    weight: x => (x.cold || x.hot ? 1.5 : 0.5),
    init: () => ({ asalto: 0 }),
    first: 'sube',
    steps: {
      sube: (P, x) => beat({
        need: ['friolero'], by: P.c.friolero, lugar: 'mesa',
        line: P.state.asalto ? `🧣 ${nm(P.c.friolero)} vuelve a subir la calefacción, ahora con bufanda puesta, por si acaso.` : `🌡️ ${nm(P.c.friolero)} sube la calefacción a 26 grados. «Por fin se siente uno los dedos».`,
        scenes: [{ c: P.c.friolero, lugar: 'mesa', que: 'Toquetea el termostato', frase: 'Hace un frío que pela.', min: 6 }],
        state: { asalto: P.state.asalto + 1 },
        next: ['baja', [20, 60]],
      }),
      baja: (P, x) => {
        if (!x.present(P.c.caluroso)) return beat({ wait: true });
        const base = { by: P.c.caluroso, con: P.c.friolero, lugar: 'mesa', rel: [[P.c.friolero, P.c.caluroso, 0.2, 0], [P.c.caluroso, P.c.friolero, 0.15, 0]] };
        if (P.state.asalto >= 3 || (P.state.asalto >= 2 && x.r() < 0.5)) {
          if (x.r() < 0.55) {
            return beat({
              ...base, line: `💥 De tanto subirlo y bajarlo, el aire acondicionado dice basta. ${nm(P.c.friolero)} y ${nm(P.c.caluroso)} se miran.`,
              incident: { kind: 'aire_roto', cause: P.c.caluroso },
              end: 'roto',
            });
          }
          return beat({
            ...base, rel: [[P.c.friolero, P.c.caluroso, -0.3, 0.1], [P.c.caluroso, P.c.friolero, -0.3, 0.1]],
            line: `📜 ${nm(P.c.friolero)} y ${nm(P.c.caluroso)} firman un pacto: 22 grados y una manta compartida.`,
            end: 'pacto',
          });
        }
        return beat({
          ...base,
          line: `🥵 ${nm(P.c.caluroso)} baja la calefacción a 19 y abre una ventana. ${nm(P.c.friolero)} se pone el abrigo dentro.`,
          scenes: [{ c: P.c.caluroso, lugar: 'mesa', que: 'Abre la ventana de par en par', frase: 'Aquí se asa uno.', min: 6 }],
          next: ['sube', [20, 60]],
        });
      },
    },
  },

  cumple_sorpresa: {
    icon: '🎂', title: P => `Sorpresa para ${nm(P.c.homenajeado)}`,
    gossip: P => `la sorpresa para ${nm(P.c.homenajeado)}`,
    roles: ['homenajeado', 'organizador'],
    needs: [],
    when: x => {
      const h = pick(x.r, x.here);
      const o = h && (x.here.filter(c => c.id !== h.id).sort((a, b) => x.rel(b, h).aprecio - x.rel(a, h).aprecio)[0]);
      return o ? { homenajeado: h, organizador: o } : null;
    },
    weight: 0.6,
    first: 'colecta',
    steps: {
      colecta: (P, x) => {
        const visita = pick(x.r, x.here.filter(c => c.id !== P.ids.homenajeado && c.id !== P.ids.organizador));
        return beat({
          need: ['organizador'], by: P.c.organizador, lugar: 'mesa',
          line: `💸 ${nm(P.c.organizador)} pasa un sobre por las mesas para una tarta sorpresa para ${nm(P.c.homenajeado)}. Chsss.`,
          scenes: [{ c: P.c.organizador, lugar: 'mesa', con: visita, que: 'Pasa el sobre de la colecta', frase: 'Chsss, para la tarta.', min: 12 }],
          next: ['casi', [40, 120]],
        });
      },
      casi: (P, x) => {
        const o = P.c.organizador;
        const h = P.c.homenajeado;
        if (x.present(o) && x.present(h) && (x.traits(o).torpe || x.r() < 0.35)) {
          return beat({
            by: o, con: h, lugar: 'mesa',
            line: `🙊 ${nm(o)} casi lo suelta delante de ${nm(h)}: «¿Te gusta el chocolate? Por nada, por nada».`,
            scenes: [{ c: o, lugar: 'mesa', con: h, que: 'Disimula fatal', frase: 'Por nada, por nada.', min: 6 }],
            state: { pillado: true },
            next: ['tarta', [20, 60]],
          });
        }
        return beat({ next: ['tarta', [10, 40]], silent: true });
      },
      tarta: (P, x) => {
        const h = P.c.homenajeado;
        const o = P.c.organizador;
        const todos = x.here.filter(c => c.id !== h.id);
        if (!x.present(h)) {
          if ((P.waits || 0) < MAX_WAITS - 1) return beat({ wait: true });
          return beat({ by: o, lugar: 'cafe', line: `🎂 ${nm(h)} no ha venido. Se comen la tarta sin ${nm(h)} y le guardan un trozo. Más o menos.`, end: 'sin_homenajeado' });
        }
        return beat({
          by: o, con: h, lugar: 'cafe',
          line: `🎂 ¡Sorpresa en la cocina! Tarta para ${nm(h)}.${P.state.pillado ? ` Finge muy mal que no lo sabía.` : ' No se lo esperaba.'}`,
          scenes: [{ c: h, lugar: 'cafe', que: 'Sopla las velas', frase: P.state.pillado ? '¡Qué sorpresa! (ya lo sabía)' : '¡No me lo puedo creer!', min: 15 },
            ...todos.map(c => ({ c, lugar: 'cafe', que: 'Canta el cumpleaños feliz', frase: '¡Cumpleaños feliz!', min: 15 }))],
          rel: [[h, o, 0, 0.35], ...todos.map(c => [h, c, 0, 0.1])],
          stats: [[h, { animo: 0.8 }], ...todos.map(c => [c, { animo: 0.2, saciedad: 0.3 }])],
          end: 'tarta',
        });
      },
    },
  },

  excursion_bar: {
    icon: '☕', title: P => `La expedición al bar de abajo de ${nm(P.c.lider)}`,
    gossip: P => `la excursión al bar de ${nm(P.c.lider)}`,
    roles: ['lider'],
    needs: [],
    when: () => null, // solo si se rompe la cafetera
    first: 'sale',
    steps: {
      sale: (P, x) => {
        const l = P.c.lider;
        const grupo = x.here.filter(c => c.id !== l.id).sort((a, b) => x.rel(l, b).aprecio - x.rel(l, a).aprecio).slice(0, 2);
        return beat({
          need: ['lider'], by: l, lugar: 'recepcion',
          line: `☕ Sin café no se puede: ${nm(l)} organiza una expedición al bar de abajo${grupo.length ? ` con ${grupo.map(nm).join(' y ')}` : ''}.`,
          scenes: [l, ...grupo].map(c => ({ c, lugar: 'recepcion', que: 'Baja al bar de abajo', frase: '¡Al bar!', min: 20 })),
          state: { grupo: grupo.map(c => c.id) },
          next: ['vuelve', [22, 40]],
        });
      },
      vuelve: (P, x) => {
        const l = P.c.lider;
        const rezagado = x.byId(pick(x.r, P.state.grupo || []));
        const jefe = rezagado && x.boss(rezagado);
        if (rezagado && x.r() < 0.45) {
          return beat({
            by: rezagado, lugar: 'recepcion',
            line: `⏰ ${nm(rezagado)} se entretiene en el bar viendo la tele y vuelve tarde.${jefe && x.present(jefe) ? ` ${nm(jefe)} mira el reloj sin decir nada. Mucho.` : ''}`,
            rel: jefe ? [[jefe, rezagado, 0.2, 0]] : [],
            end: 'tarde',
          });
        }
        const todos = x.here.filter(c => c.id !== (l && l.id));
        return beat({
          by: l, lugar: 'cafe',
          line: `🥤 ${nm(l)} vuelve del bar con cafés para toda la oficina. Héroe del día.`,
          scenes: [{ c: l, lugar: 'cafe', que: 'Reparte cafés del bar', frase: '¡Uno con leche para ti!', min: 10 }],
          rel: todos.map(c => [c, l, 0, 0.15]),
          stats: todos.map(c => [c, { energia: 0.3, animo: 0.1 }]),
          end: 'heroe',
        });
      },
    },
  },

  nota_micro: {
    icon: '🐟', title: P => `El pescado de ${nm(P.c.cocinero)}`,
    gossip: P => `la nota del micro contra ${nm(P.c.cocinero)}`,
    roles: ['cocinero', 'quejica'],
    needs: [],
    when: () => null, // solo si huele la cocina
    first: 'nota',
    steps: {
      nota: (P, x) => beat({
        need: ['quejica'], by: P.c.quejica, con: P.c.cocinero, lugar: 'cafe',
        line: `📝 ${nm(P.c.quejica)} pega una nota en el micro: «Prohibido calentar pescado. Esto es una oficina, no una lonja».`,
        scenes: [{ c: P.c.quejica, lugar: 'cafe', que: 'Pega una nota en el micro', frase: 'Que quede claro.', min: 6 }],
        rel: [[P.c.cocinero, P.c.quejica, 0.3, 0]],
        next: ['respuesta', [120, 300]],
      }),
      respuesta: (P, x) => {
        const k = P.c.cocinero;
        if (!x.present(k)) return beat({ wait: true });
        if (x.traits(k).malaLeche || x.rel(k, P.c.quejica).roce > 0.5) {
          return beat({
            by: k, con: P.c.quejica, lugar: 'cafe',
            line: `🐟 ${nm(k)} contesta a la nota a su manera: vuelve a calentar pescado. Ración doble.`,
            incident: { kind: 'olor_micro', cause: k },
            rel: [[P.c.quejica, k, 0.4, 0]],
            spawn: x.r() < 0.4 ? { kind: 'guerra_postits', cast: { atacante: P.c.quejica, victima: k } } : null,
            end: 'reincide',
          });
        }
        return beat({
          by: k, con: P.c.quejica, lugar: 'cafe',
          line: `🍪 ${nm(k)} deja galletas junto al micro con otra nota: «Perdón por el pescado. No volverá a pasar (esta semana)».`,
          scenes: [{ c: k, lugar: 'cafe', que: 'Deja galletas de disculpa', frase: 'Perdón, perdón.', min: 6 }],
          rel: [[P.c.quejica, k, -0.2, 0.3]],
          end: 'galletas',
        });
      },
    },
  },
};

// Qué tramas arranca cada incidente (causa → consecuencia). roles: a partir del incidente y la oficina.
const FROM_INCIDENT = {
  postits_movidos: { kind: 'guerra_postits', p: 0.7, cast: (inc, x) => (inc.cause && inc.victim ? { atacante: inc.cause, victima: inc.victim } : null) },
  cafetera_rota: { kind: 'excursion_bar', p: 0.6, cast: (inc, x) => ({ lider: inc.cause || pick(x.r, x.here) }) },
  sin_cafe: { kind: 'excursion_bar', p: 0.6, cast: (inc, x) => ({ lider: inc.cause || pick(x.r, x.here) }) },
  olor_micro: {
    kind: 'nota_micro', p: 0.55,
    cast: (inc, x) => {
      if (!inc.cause) return null;
      const rest = x.here.filter(c => c.id !== inc.cause.id);
      const q = pick(x.r, rest.filter(c => x.traits(c).malaLeche)) || pick(x.r, rest);
      return q ? { cocinero: inc.cause, quejica: q } : null;
    },
  },
  nevera_olvidada: { kind: 'taper_misterioso', p: 0.3, cast: (inc, x) => PLOTS.taper_misterioso.when({ ...x, lunch: true }) },
};

// ¿Puede empezar en esta oficina? (los objetos que necesita)
const fits = (def, mapTypes) => !mapTypes || def.needs.every(t => mapTypes.has(t));
const weightOf = (def, x) => (typeof def.weight === 'function' ? def.weight(x) : def.weight || 0);

// ¿Empieza sola alguna trama en este minuto? Devuelve { kind, cast, state } o null.
function maybeStart(x, { active, startedToday, minute }) {
  if (active.length >= MAX_ACTIVE || startedToday >= MAX_NEW_PER_DAY || x.here.length < 2) return null;
  if (x.r() >= START_PER_HOUR / 60) return null;
  const busy = new Set(active.map(p => p.kind));
  const options = Object.entries(PLOTS).filter(([k, d]) => !busy.has(k) && d.when && fits(d, x.mapTypes) && weightOf(d, x) > 0);
  const total = options.reduce((s, [, d]) => s + weightOf(d, x), 0);
  let t = x.r() * total;
  for (const [kind, def] of options) {
    t -= weightOf(def, x);
    if (t > 0) continue;
    const cast = def.when(x);
    return cast ? { kind, cast, state: def.init ? def.init(x) : {}, minute } : null;
  }
  return null;
}

// ¿Este incidente arranca una trama? inc: { kind, cause, victim } con personajes.
function fromIncident(inc, x, active) {
  const rule = FROM_INCIDENT[inc.kind];
  if (!rule || active.length >= MAX_ACTIVE || active.some(p => p.kind === rule.kind)) return null;
  const def = PLOTS[rule.kind];
  if (!fits(def, x.mapTypes) || x.r() >= rule.p) return null;
  const cast = rule.cast(inc, x);
  if (!cast || Object.values(cast).some(c => !c)) return null;
  return { kind: rule.kind, cast, state: def.init ? def.init(x) : {} };
}

// Un paso de la trama. P: { kind, step, ids, cast (personajes, null si no está hoy), state, waits }.
// Devuelve el beat ya normalizado, o { wait: true } si falta alguien.
function runStep(P, x) {
  const def = PLOTS[P.kind];
  const fn = def && def.steps[P.step];
  if (!fn) return { end: 'perdida' };
  const b = fn(P, x) || { end: 'perdida' };
  if (b.need && b.need.some(role => !x.present(P.c[role]))) return { wait: true };
  return b;
}

// Relaciones: { 'a>b': { roce, aprecio } } (dirigidas: lo que a siente por b).
const relKey = (a, b) => `${a}>${b}`;
function applyRel(map, deltas) {
  const changed = [];
  for (const [a, b, dr, da] of deltas || []) {
    if (!a || !b || a.id === b.id) continue;
    const k = relKey(a.id, b.id);
    const cur = map.get(k) || { roce: 0, aprecio: 0 };
    const next = { roce: clamp(cur.roce + (dr || 0)), aprecio: clamp(cur.aprecio + (da || 0)) };
    map.set(k, next);
    changed.push([a.id, b.id, next]);
  }
  return changed;
}
const clamp = v => Math.max(0, Math.min(1, Math.round(v * 100) / 100));
function decay(rel) {
  return { roce: clamp(rel.roce * REL_DECAY.roce), aprecio: clamp(rel.aprecio * REL_DECAY.aprecio) };
}

// Afinidad que suman las relaciones a la de siempre (para las comidas): aprecio mutuo menos roce mutuo.
function bond(map, a, b) {
  const ab = map.get(relKey(a, b)) || { roce: 0, aprecio: 0 };
  const ba = map.get(relKey(b, a)) || { roce: 0, aprecio: 0 };
  return (ab.aprecio + ba.aprecio) / 2 - (ab.roce + ba.roce) / 2;
}

module.exports = {
  PLOTS, FROM_INCIDENT, RUMORS, MAX_ACTIVE, MAX_NEW_PER_DAY, START_PER_HOUR, MAX_WAITS,
  maybeStart, fromIncident, runStep, applyRel, decay, bond, relKey, between, rng,
};
