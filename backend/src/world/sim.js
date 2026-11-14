// La oficina viva. Cada segundo (real) mira la hora de la oficina, mueve a cada personaje
// según su plan y, al empezar cada bloque, deja en cola un turno de IA para planificarlo.
// Mientras el turno no vuelve, el personaje va en piloto automático.

const clockLib = require('./clock');
const { parts, blockOf, isWorkday, dreamWindowOpen, nextMorning, addDays } = clockLib;
const { ACTION_FOR_PLACE, targetFor } = require('./places');
const { autopilotPlan } = require('./autopilot');
const gm = require('./gameMaster');
const prompts = require('../ai/prompts');
const turns = require('../ai/turns');

const HUMOR_REPR = {
  euforico: 'cantando',
  contento: null,
  normal: null,
  mosqueado: 'enfadado',
  agobiado: 'tirandose_del_pelo',
  triste: 'nube_en_la_cabeza',
  dormido: 'somnoliento',
};
const BUBBLE_MS = 8000;

class Sim {
  constructor({ pool, io, clock, tickMs = 1000 }) {
    this.pool = pool;
    this.io = io;
    this.clock = clock;
    this.tickMs = tickMs;
    this.plans = new Map(); // `${id}|${day}|${block}` -> actions
    this.ensured = new Set(); // turnos ya pedidos o descartados
    this.current = new Map(); // id -> {key, action, bubbleUntil}
    this.notified = new Set(); // avisos de una sola vez (tope gastado)
    this.chars = [];
    this.lastLoad = 0;
    this.running = false;
  }

  start() {
    this.timer = setInterval(() => {
      if (this.running) return;
      this.running = true;
      this.tick().catch(e => console.error('tick:', e)).finally(() => { this.running = false; });
    }, this.tickMs);
  }

  stop() {
    clearInterval(this.timer);
  }

  now() {
    return parts(this.clock.nowMs());
  }

  async loadCharacters(force = false) {
    if (!force && Date.now() - this.lastLoad < 5000) return this.chars;
    const r = await this.pool.query(
      `SELECT c.*, COALESCE(u.avatar_config, c.avatar_config) AS avatar,
              COALESCE(c.owner_user_id, (SELECT id FROM users WHERE is_admin ORDER BY id LIMIT 1)) AS payer
         FROM characters c LEFT JOIN users u ON u.id = c.owner_user_id
        WHERE c.approved AND NOT c.paused ORDER BY c.id`,
    );
    this.chars = r.rows;
    this.lastLoad = Date.now();
    return this.chars;
  }

  invalidate() {
    this.lastLoad = 0;
  }

  async getPlan(c, day, block) {
    const key = `${c.id}|${day}|${block}`;
    if (this.plans.has(key)) return this.plans.get(key);
    let r = await this.pool.query(
      'SELECT actions FROM plans WHERE character_id = $1 AND day = $2 AND block = $3', [c.id, day, block]);
    if (!r.rows.length) {
      const actions = autopilotPlan(c, day, block);
      await this.pool.query(
        `INSERT INTO plans (character_id, day, block, source, actions) VALUES ($1, $2, $3, 'autopiloto', $4)
         ON CONFLICT DO NOTHING`, [c.id, day, block, JSON.stringify(actions)]);
      r = await this.pool.query(
        'SELECT actions FROM plans WHERE character_id = $1 AND day = $2 AND block = $3', [c.id, day, block]);
    }
    const actions = r.rows[0].actions;
    this.plans.set(key, actions);
    return actions;
  }

  async context(c, day) {
    const [diary, news, dream] = await Promise.all([
      this.pool.query('SELECT text FROM diaries WHERE character_id = $1 AND day < $2 ORDER BY day DESC LIMIT 1', [c.id, day]),
      // Solo lo que da juego: acciones y sueños (los avisos del sistema son tokens tirados).
      this.pool.query("SELECT text FROM feed WHERE kind IN ('accion', 'sueno') ORDER BY id DESC LIMIT 8"),
      this.pool.query('SELECT text FROM dreams WHERE character_id = $1 AND morning = $2', [c.id, day]),
    ]);
    return {
      yesterdayDiary: diary.rows[0] ? diary.rows[0].text : null,
      news: news.rows.map(x => x.text).reverse(),
      dream: dream.rows[0] ? dream.rows[0].text : null,
    };
  }

  async request(kind, c, day, block, request) {
    const res = await turns.enqueue(this.pool, {
      kind, characterId: c.id, payerUserId: c.payer, day, block, model: c.model, request,
    });
    if (res.skipped === 'tope' && !this.notified.has(`${c.payer}|${day}`)) {
      this.notified.add(`${c.payer}|${day}`);
      await this.post(c.id, 'sistema', `💸 ${c.name} va en piloto automático: se ha gastado el tope de IA de hoy.`, day);
    }
    return res;
  }

  // Pide el turno que toque en este bloque, una sola vez.
  async ensureTurn(c, day, block) {
    const key = `${c.id}|${day}|${block}`;
    if (this.ensured.has(key)) return;
    this.ensured.add(key);
    const prev = await this.pool.query(
      `SELECT kind FROM turns WHERE character_id = $1 AND office_day = $2 AND kind IN ('despertar', 'tarde')
         AND status IN ('queued', 'running', 'done')`, [c.id, day]);
    const kinds = new Set(prev.rows.map(r => r.kind));
    let kind = null;
    if (!kinds.has('despertar')) kind = 'despertar';
    else if (block === 'tarde' && !kinds.has('tarde')) {
      // Si se despertó ya por la tarde, ese turno ya planificó la tarde.
      const late = await this.pool.query(
        `SELECT 1 FROM turns WHERE character_id = $1 AND office_day = $2 AND kind = 'despertar' AND block = 'tarde'`,
        [c.id, day]);
      if (!late.rows.length) kind = 'tarde';
    }
    if (!kind) return;
    const cast = await this.loadCharacters();
    const ctx = await this.context(c, day);
    const request = prompts.planRequest({ kind, character: c, cast, day, block, ...ctx });
    await this.request(kind, c, day, block, request);
  }

  async ensureDiary(c, day) {
    const key = `${c.id}|${day}|diario`;
    if (this.ensured.has(key)) return;
    this.ensured.add(key);
    const worked = await this.pool.query('SELECT actions FROM plans WHERE character_id = $1 AND day = $2 ORDER BY block', [c.id, day]);
    if (!worked.rows.length) return;
    const done = await this.pool.query('SELECT 1 FROM diaries WHERE character_id = $1 AND day = $2', [c.id, day]);
    if (done.rows.length) return;
    const cast = await this.loadCharacters();
    const news = (await this.pool.query("SELECT text FROM feed WHERE office_day = $1 AND kind IN ('accion', 'sueno') ORDER BY id DESC LIMIT 6", [day]))
      .rows.map(x => x.text).reverse();
    const todayActions = worked.rows.flatMap(r => r.actions);
    const request = prompts.diaryRequest({ character: c, cast, day, todayActions, news });
    await this.request('diario', c, day, null, request);
  }

  async post(characterId, kind, text, day) {
    const r = await this.pool.query(
      'INSERT INTO feed (character_id, kind, text, office_day) VALUES ($1, $2, $3, $4) RETURNING id, character_id, kind, text, created_at',
      [characterId, kind, text, day]);
    this.io.emit('feed', r.rows[0]);
  }

  async tick() {
    const p = this.now();
    const block = blockOf(p);
    const day = p.date;
    await turns.maintain(this.pool, { day, block });
    const chars = await this.loadCharacters();
    const cast = chars;
    const view = [];

    for (const c of chars) {
      if (block === 'noche') {
        this.current.delete(c.id);
        if (isWorkday(p.weekday) && p.minutes >= clockLib.BLOCKS.tarde.to) await this.ensureDiary(c, day);
        view.push(this.viewOf(c, null, null, true));
        continue;
      }
      const actions = await this.getPlan(c, day, block);
      await this.ensureTurn(c, day, block);
      let idx = 0;
      for (let i = 0; i < actions.length; i++) if (actions[i].min <= p.minutes) idx = i;
      const a = actions[idx];
      const key = `${day}|${block}|${idx}|${a.que}`;
      const cur = this.current.get(c.id);
      if (!cur || cur.key !== key) {
        const bubbleUntil = a.frase ? Date.now() + BUBBLE_MS : 0;
        this.current.set(c.id, { key, action: a, bubbleUntil });
        if (cur) await this.onActionStart(c, a, cast, day);
      }
      view.push(this.viewOf(c, this.current.get(c.id), cast, false));
    }

    this.io.emit('world', {
      clock: { date: day, hhmm: p.hhmm, weekday: p.weekday, block, dreamOpen: dreamWindowOpen(p), nextMorning: nextMorning(p) },
      characters: view,
    });
  }

  async onActionStart(c, a, cast, day) {
    const cafe = a.lugar === 'cafe' ? Math.min(10, c.cafe + 4) : Math.max(0, c.cafe - 1);
    // Cocina, sofás y terraza recargan; lo demás cansa.
    const energia = ['cafe', 'descanso', 'terraza'].includes(a.lugar) ? Math.min(10, c.energia + 1) : Math.max(0, c.energia - 1);
    c.cafe = cafe;
    c.energia = energia;
    await this.pool.query('UPDATE characters SET cafe = $2, energia = $3 WHERE id = $1', [c.id, cafe, energia]);
    const con = a.con ? cast.find(x => x.id === a.con) : null;
    const text = `${c.name}: ${a.que}${con ? ` (con ${con.name})` : ''}${a.frase ? ` — «${a.frase}»` : ''}`;
    await this.post(c.id, 'accion', text, day);
  }

  viewOf(c, cur, cast, home) {
    const base = {
      id: c.id,
      name: c.name,
      owner_user_id: c.owner_user_id,
      avatar_config: c.avatar,
      desk_index: c.desk_index,
      humor: c.humor,
      energia: c.energia,
      cafe: c.cafe,
      model: c.model,
    };
    if (home || !cur) return { ...base, home: true };
    const a = cur.action;
    const withDesk = a.con && cast ? (cast.find(x => x.id === a.con) || {}).desk_index : null;
    const lugar = a.lugar === 'mesa' && withDesk != null ? 'visita' : a.lugar;
    const pos = targetFor({ lugar: a.lugar, deskIndex: c.desk_index, withDeskIndex: withDesk, slot: c.id });
    return {
      ...base,
      home: false,
      x: pos.x,
      y: pos.y,
      lugar,
      que: a.que,
      action: c.energia <= 1 ? 'durmiendo' : ACTION_FOR_PLACE[lugar],
      representation: HUMOR_REPR[c.humor] || null,
      bubble: cur.bubbleUntil > Date.now() ? a.frase : null,
    };
  }

  // --- Resultados de la IA ---

  async applyTurn(turn) {
    const c = (await this.loadCharacters(true)).find(x => x.id === turn.character_id)
      || (await this.pool.query('SELECT * FROM characters WHERE id = $1', [turn.character_id])).rows[0];
    if (!c) return;
    const out = turn.result;
    const day = turn.office_day;
    if (turn.kind === 'despertar' || turn.kind === 'tarde') {
      const v = gm.validateWake(out, { block: turn.block, names: this.chars, selfId: c.id });
      await this.mergePlan(c, day, turn.block, v.plan);
      await this.pool.query('UPDATE characters SET humor = $2 WHERE id = $1', [c.id, v.humor]);
      if (turn.kind === 'despertar' && v.sueno) await this.applyDream(c, day, v.sueno);
    } else if (turn.kind === 'diario') {
      const v = gm.validateDiary(out);
      await this.pool.query(
        `INSERT INTO diaries (character_id, day, text) VALUES ($1, $2, $3)
         ON CONFLICT (character_id, day) DO UPDATE SET text = EXCLUDED.text`, [c.id, day, v.diario]);
      await this.pool.query('UPDATE characters SET humor = $2 WHERE id = $1', [c.id, v.humor]);
      await this.post(c.id, 'diario', `📔 ${c.name} ha escrito su diario.`, day);
    } else if (turn.kind === 'perfil') {
      const ficha = gm.validateProfile(out);
      await this.pool.query('UPDATE characters SET ficha = $2 WHERE id = $1', [c.id, ficha]);
    } else if (turn.kind === 'sueno_ayuda') {
      gm.validateDreamHelp(out); // el resultado se lee desde el turno
    }
    this.invalidate();
  }

  // Lo ya vivido se queda; lo que la IA planea a partir de ahora sustituye al piloto automático.
  async mergePlan(c, day, block, iaActions) {
    const p = this.now();
    const live = p.date === day && blockOf(p) === block;
    const nowMin = live ? p.minutes : -1;
    const old = await this.getPlan(c, day, block);
    const past = old.filter(a => a.min <= nowMin);
    let next = iaActions.filter(a => a.min > nowMin);
    if (live && !next.length && iaActions.length) next = [{ ...iaActions[iaActions.length - 1], min: nowMin + 1 }];
    const actions = [...past, ...next].sort((x, y) => x.min - y.min);
    await this.pool.query(
      `INSERT INTO plans (character_id, day, block, source, actions) VALUES ($1, $2, $3, 'ia', $4)
       ON CONFLICT (character_id, day, block) DO UPDATE SET source = 'ia', actions = EXCLUDED.actions`,
      [c.id, day, block, JSON.stringify(actions)]);
    this.plans.set(`${c.id}|${day}|${block}`, actions);
  }

  async applyDream(c, day, sueno) {
    const r = await this.pool.query(
      `UPDATE dreams SET followed = $3, reason = $4, updated_at = NOW()
        WHERE character_id = $1 AND morning = $2 RETURNING text`, [c.id, day, sueno.hace_caso, sueno.por_que]);
    if (!r.rows.length) return;
    const verbo = sueno.hace_caso ? 'decide hacerle caso' : 'pasa olímpicamente';
    await this.post(c.id, 'sueno', `💭 ${c.name} se despierta tras un sueño raro y ${verbo}: «${sueno.por_que}»`, day);
  }
}

module.exports = { Sim, HUMOR_REPR, addDays };
