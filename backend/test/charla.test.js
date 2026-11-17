// Comer con estilo propio (eating.js) y conversaciones con bocadillos alternos (chatter.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const eating = require('../src/world/eating');
const { Chatter, groupsOf, buildConversation, weatherTopic, LINE_MS, WARMUP_MS, QUIET_MS } = require('../src/world/chatter');
const { heardBy } = require('../src/world/hearing');

const DAY = '2026-11-16';
const person = (id, ficha = {}) => ({ id, name: `P${id}`, ficha });

// --- comer ---

test('comer: la comida del piloto y los textos de comer cuentan; volver de comer, no', () => {
  assert.ok(eating.isEating({ comida: true, que: 'Comen juntos en la terraza' }));
  assert.ok(eating.isEating({ que: 'Come de táper' }));
  assert.ok(eating.isEating({ que: 'Comida de táper en grupo' }));
  assert.ok(!eating.isEating({ que: 'Vuelve de comer y lucha contra la modorra' }));
  assert.ok(!eating.isEating({ que: 'Café y cotilleo en la cocina' }));
  assert.ok(!eating.isEating(null));
});

test('comer: el estilo es de la persona (el mismo todos los días) y sale de un catálogo cerrado', () => {
  for (let id = 1; id <= 40; id++) {
    const c = person(id);
    const a = eating.eatingStyle(c, { que: 'Come de táper' }, '2026-11-16');
    const b = eating.eatingStyle(c, { que: 'Come de táper' }, '2026-11-17');
    assert.equal(a.style, b.style, 'el estilo no cambia de un día a otro');
    assert.ok(eating.STYLES.includes(a.style));
    assert.ok(typeof a.food === 'string' && a.food.length);
  }
});

test('comer: no comen todos igual', () => {
  const styles = new Set();
  for (let id = 1; id <= 40; id++) styles.add(eating.styleOf(person(id)));
  assert.ok(styles.size >= 5, `solo ${styles.size} estilos distintos entre 40 personas`);
});

test('comer: la ficha manda (palillos, móvil, prisa, dieta, cotilla)', () => {
  assert.equal(eating.styleOf(person(1, { manias: ['Pide sushi todos los viernes'] })), 'palillos');
  assert.equal(eating.styleOf(person(2, { personalidad: 'Vive pegada al móvil' })), 'movil');
  assert.equal(eating.styleOf(person(3, { personalidad: 'Siempre con prisa, todo es urgente' })), 'rapido');
  assert.equal(eating.styleOf(person(4, { manias: ['Va al gimnasio a mediodía'] })), 'bocaditos');
  assert.equal(eating.styleOf(person(5, { personalidad: 'Cotilla profesional' })), 'habla');
});

test('comer: el torpe se mancha (si la ficha no dice otra cosa)', () => {
  assert.equal(eating.styleOf(person(6, { personalidad: 'Un desastre con patas, muy torpe' })), 'mancha');
});

test('comer: quien come «mirando vídeos» lo hace con el móvil', () => {
  const c = person(7, { manias: ['Pide sushi todos los viernes'] });
  assert.equal(eating.eatingStyle(c, { que: 'Come en la mesa mirando vídeos' }).style, 'movil');
  assert.equal(eating.eatingStyle(c, { que: 'Come de táper' }).style, 'palillos');
});

test('comer: con palillos se come sushi, arroz o fideos; el del bocata, bocata', () => {
  const c = person(8, { manias: ['Comer con palillos'] });
  for (let d = 1; d <= 10; d++) assert.ok(['sushi', 'arroz', 'fideos'].includes(eating.eatingStyle(c, {}, `d${d}`).food));
  assert.equal(eating.eatingStyle(person(9, { manias: ['Se trae un bocadillo enorme'] }), {}).food, 'bocata');
});

// --- grupos ---

const view = (id, lugar, extra = {}) => ({ id, name: `P${id}`, mode: 'oficina', lugar, ...extra });
const entry = (v, a = {}, ficha = {}) => ({ v, a, c: { id: v.id, ficha } });

test('charla: se juntan los de la misma sala, las visitas y el ping-pong; los solos y el baño, no', () => {
  const g = groupsOf([
    entry(view(1, 'cafe')), entry(view(2, 'cafe')), entry(view(3, 'cafe')),
    entry(view(4, 'visita'), { con: 5 }), entry(view(5, 'mesa')),
    entry(view(6, 'descanso'), { micro: { kind: 'pingpong' }, con: 7 }), entry(view(7, 'descanso'), { micro: { kind: 'pingpong' }, con: 6 }),
    entry(view(8, 'terraza')),
    entry(view(9, 'lavabo')), entry(view(10, 'lavabo')),
    entry(view(11, 'cafe', { mode: 'remoto' })),
  ]);
  const keys = g.map(x => x.key).sort();
  assert.deepEqual(keys, ['pingpong|6|7', 'sala|cafe|0', 'visita|4|5']);
  assert.deepEqual(g.find(x => x.key === 'sala|cafe|0').ids, [1, 2, 3]);
});

test('charla: en una sala llena se hacen corrillos de 2 a 4 (nadie se queda hablando solo)', () => {
  for (let n = 2; n <= 14; n++) {
    const g = groupsOf(Array.from({ length: n }, (_, i) => entry(view(i + 1, 'terraza'))));
    assert.equal(g.reduce((s, x) => s + x.ids.length, 0), n, 'alguien se ha quedado fuera');
    for (const x of g) assert.ok(x.ids.length >= 2 && x.ids.length <= 4, `corrillo de ${x.ids.length} con ${n} personas`);
  }
});

test('charla: una visita a alguien que no está (en casa) no es conversación', () => {
  assert.deepEqual(groupsOf([entry(view(4, 'visita'), { con: 5 }), entry(view(5, 'casa', { mode: 'remoto' }))]), []);
});

// --- conversaciones ---

const members = [
  { id: 1, name: 'Ana', muletillas: ['Esto es un sinvivir.'], eat: null },
  { id: 2, name: 'Bea', muletillas: ['¡Ni de broma!'], eat: null },
  { id: 3, name: 'Carlos', muletillas: [], eat: null },
];

test('charla: 2-4 frases, alternas (nadie habla dos veces seguidas) y entre los que están', () => {
  const sizes = new Set();
  for (let i = 0; i < 80; i++) {
    const { lines } = buildConversation({ kind: 'sala', lugar: 'cafe', ids: [1, 2, 3] }, members, {}, `s${i}`);
    sizes.add(lines.length);
    assert.ok(lines.length >= 2 && lines.length <= 4);
    for (let k = 1; k < lines.length; k++) assert.notEqual(lines[k].id, lines[k - 1].id, 'dos frases seguidas del mismo');
    for (const l of lines) {
      assert.ok([1, 2, 3].includes(l.id));
      assert.ok(l.text && !/\{[a-z]+\}/i.test(l.text), `hueco sin rellenar: ${l.text}`);
    }
  }
  assert.deepEqual([...sizes].sort(), [2, 3, 4]);
});

test('charla: es determinista con la misma semilla', () => {
  const g = { kind: 'sala', lugar: 'terraza', ids: [1, 2] };
  assert.deepEqual(buildConversation(g, members.slice(0, 2), {}, 'x'), buildConversation(g, members.slice(0, 2), {}, 'x'));
});

test('charla: salen las muletillas de cada ficha (y en boca de su dueño)', () => {
  const said = [];
  for (let i = 0; i < 200; i++) said.push(...buildConversation({ kind: 'sala', lugar: 'cafe', ids: [1, 2] }, members.slice(0, 2), {}, `m${i}`).lines);
  const ana = said.filter(l => l.text === 'Esto es un sinvivir.');
  const bea = said.filter(l => l.text === '¡Ni de broma!');
  assert.ok(ana.length && bea.length, 'no sale ninguna muletilla');
  assert.ok(ana.every(l => l.id === 1) && bea.every(l => l.id === 2), 'una muletilla en boca de otro');
});

test('charla: los incidentes abiertos y el tiempo dan tema', () => {
  const ctx = { incidents: [{ kind: 'maquina_rota', place: 'cafe', title: '🥤 La máquina de snacks se traga el euro de Ana. Ya no da nada.' }] };
  const topics = new Map();
  let mentions = 0;
  for (let i = 0; i < 100; i++) {
    const c = buildConversation({ kind: 'sala', lugar: 'cafe', ids: [1, 2] }, members.slice(0, 2), ctx, `i${i}`);
    topics.set(c.topic, (topics.get(c.topic) || 0) + 1);
    if (c.lines.some(l => l.text.includes('La máquina de snacks se traga el euro de Ana'))) mentions++;
  }
  assert.ok((topics.get('incidente') || 0) > 30, 'casi nunca hablan del incidente');
  assert.ok(mentions > 0, 'nunca nombran el incidente');
  assert.equal(weatherTopic({ code: 63, temp: 12 }), 'lluvia');
  assert.equal(weatherTopic({ code: 73, temp: 0 }), 'nieve');
  assert.equal(weatherTopic({ code: 0, temp: 34 }), 'calor');
  assert.equal(weatherTopic({ code: 1, temp: 18 }), null);
});

test('charla: comiendo hablan de comida, y el que habla con la boca llena se nota', () => {
  const m = [{ ...members[0], eat: { style: 'habla', food: 'lentejas' } }, { ...members[1], eat: { style: 'taper', food: 'pasta' } }];
  let full = 0;
  for (let i = 0; i < 40; i++) {
    const c = buildConversation({ kind: 'sala', lugar: 'cafe', ids: [1, 2] }, m, {}, `c${i}`);
    assert.equal(c.context, 'comida');
    for (const l of c.lines) if (l.id === 1) { assert.ok(l.text.startsWith('(ñam) ')); full++; }
    for (const l of c.lines) if (l.id === 2) assert.ok(!l.text.startsWith('(ñam)'));
  }
  assert.ok(full > 0);
});

// --- el ritmo (tiempo real) ---

function run(chatter, entriesFn, fromMs, toMs, stepMs = 1000, ctx = {}) {
  const frames = [];
  const posts = [];
  for (let t = fromMs; t <= toMs; t += stepMs) {
    const entries = entriesFn(t);
    posts.push(...chatter.update(entries, t, { day: DAY, minutes: 840 + Math.floor((t - fromMs) / 6000), ...ctx }));
    frames.push({ t, bubbles: entries.filter(e => e.v.bubble).map(e => [e.v.id, e.v.bubble]) });
  }
  return { frames, posts };
}

test('charla: espera a que pase el bocadillo de llegada, habla de uno en uno y luego hay silencio', () => {
  const chatter = new Chatter({ companyId: 1 });
  // El bocadillo de llegada dura 8 s (BUBBLE_MS en sim.js).
  const mk = t => [entry(view(1, 'cafe', t < 8000 ? { bubble: 'Llego' } : {}), {}, { muletillas: ['A'] }), entry(view(2, 'cafe'), {}, { muletillas: ['B'] })];
  const { frames } = run(chatter, mk, 0, 240000);
  // Antes del calentamiento, nadie de la conversación: el bocadillo de llegada sigue.
  for (const f of frames.filter(x => x.t < 8000)) assert.deepEqual(f.bubbles, [[1, 'Llego']]);
  // Nunca hablan dos a la vez.
  for (const f of frames) assert.ok(f.bubbles.length <= 1, `dos bocadillos a la vez en ${f.t}`);
  // Hay conversaciones con alternancia y huecos de silencio entre ellas.
  const talking = frames.filter(f => f.t >= WARMUP_MS[1] && f.bubbles.length);
  const silent = frames.filter(f => f.t >= WARMUP_MS[1] && !f.bubbles.length);
  assert.ok(talking.length > 10, 'apenas hablan');
  assert.ok(silent.length > talking.length, 'no paran de hablar: parece un gallinero');
  const speakers = new Set(talking.map(f => f.bubbles[0][0]));
  assert.deepEqual([...speakers].sort(), [1, 2]);
  // Cada frase dura lo suyo (no cambia cada segundo).
  let runs = 0; let len = 0; let prev = null;
  for (const f of talking) { const k = f.bubbles[0].join('|'); if (k !== prev) { runs++; prev = k; } len++; }
  assert.ok(len / runs >= (LINE_MS / 1000) - 1, 'los bocadillos cambian demasiado rápido');
  void QUIET_MS;
});

test('charla: si uno se va a mitad, la conversación se corta', () => {
  const chatter = new Chatter({ companyId: 1 });
  let together = true;
  const mk = () => [entry(view(1, 'cafe')), entry(view(2, together ? 'cafe' : 'mesa'))];
  run(chatter, mk, 0, WARMUP_MS[1] + 1000);
  assert.equal(chatter.convs.size, 1, 'deberían estar hablando');
  together = false;
  const { frames } = run(chatter, mk, WARMUP_MS[1] + 2000, WARMUP_MS[1] + 6000);
  assert.equal(chatter.convs.size, 0);
  for (const f of frames) assert.deepEqual(f.bubbles, []);
});

test('charla: al feed, una línea por conversación con tema y no más de una por sitio cada rato', () => {
  const chatter = new Chatter({ companyId: 1 });
  const mk = () => [entry(view(1, 'cafe', { eat: { style: 'taper', food: 'pasta' } })), entry(view(2, 'cafe', { eat: { style: 'bocata', food: 'bocata' } }))];
  // 10 minutos reales a ×10 = 100 min de oficina: como mucho 3 líneas (cada 45 min).
  const { posts } = run(chatter, mk, 0, 600000);
  assert.ok(posts.length >= 1 && posts.length <= 3, `${posts.length} líneas en el feed`);
  for (const p of posts) {
    assert.equal(p.lugar, 'cafe');
    assert.ok(p.text.startsWith('💬 '));
    assert.ok([1, 2].includes(p.id) && [1, 2].includes(p.con) && p.id !== p.con);
  }
});

test('charla: sin tema (un café cualquiera) no va al feed', () => {
  const chatter = new Chatter({ companyId: 1 });
  const { posts } = run(chatter, () => [entry(view(1, 'terraza')), entry(view(2, 'terraza'))], 0, 300000);
  assert.deepEqual(posts, []);
});

test('charla: la línea del feed la oye quien estaba en esa sala, no el resto', () => {
  const ev = { character_id: 1, con_id: 2, lugar: 'cafe', min: 845, kind: 'charla', text: '💬 …' };
  assert.equal(heardBy([ev], { id: 3, mode: 'oficina' }, [{ min: 840, lugar: 'cafe' }]).length, 1);
  assert.equal(heardBy([ev], { id: 4, mode: 'oficina' }, [{ min: 840, lugar: 'mesa' }]).length, 0);
  assert.equal(heardBy([ev], { id: 2, mode: 'oficina' }, [{ min: 840, lugar: 'mesa' }]).length, 1);
});

// --- el contrato del directo: el servidor dice quién come y cómo ---

test('directo: quien come lleva `eat` en la vista; quien trabaja, no', () => {
  const { Sim } = require('../src/world/sim');
  const sim = new Sim({ pool: null, io: null, clock: { nowMs: () => Date.now(), speed: 1 } });
  const c = { id: 3, name: 'Ana', avatar: {}, desk_index: 3, humor: 'normal', stats: { energia: 3 }, ficha: { manias: ['Comer sushi'] } };
  const at = action => sim.viewOf(c, { action, bubbleUntil: 0 }, [c], { phase: 'oficina', day: { mode: 'oficina' } });
  const eatingView = at({ min: 845, lugar: 'cafe', que: 'Comen juntos en la cocina', comida: true });
  assert.deepEqual(Object.keys(eatingView.eat).sort(), ['food', 'style']);
  assert.equal(eatingView.eat.style, 'palillos');
  assert.equal(at({ min: 600, lugar: 'mesa', que: 'Trabaja (más o menos)' }).eat, undefined);
});

test('charla: la respuesta contesta a ESA pregunta (mismo hilo) y la muletilla nunca sustituye la respuesta', () => {
  const { SCRIPTS, TOPICS } = require('../src/world/chatter');
  const hilos = [...Object.values(SCRIPTS), ...Object.values(TOPICS)].flat();
  const bare = t => t.replace(/^\(ñam\) /, '');
  const fits = (tpl, text) => new RegExp('^' + tpl.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[a-z]+\}/gi, '.*').replace(/^./, ch => `[${ch}${ch.toUpperCase()}]`) + '$').test(text);
  const places = ['cafe', 'terraza', 'descanso', 'reuniones'];
  for (let i = 0; i < 300; i++) {
    const { lines } = buildConversation({ kind: 'sala', lugar: places[i % 4], ids: [1, 2] }, members.slice(0, 2), {}, `h${i}`);
    const [q, ans] = lines.map(l => bare(l.text));
    const own = hilos.filter(h => h.a.some(t => fits(t, q)));
    assert.ok(own.length, `pregunta fuera de los guiones: ${q}`);
    assert.ok(own.some(h => h.b.some(t => fits(t, ans))), `«${q}» — «${ans}» no casan`);
  }
});
