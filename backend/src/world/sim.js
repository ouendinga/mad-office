// La oficina viva. Cada segundo (real) mira la hora de la oficina, mueve a cada personaje
// según su plan y, al empezar cada bloque, deja en cola un turno de IA para planificarlo.
// Mientras el turno no vuelve, el personaje va en piloto automático.
//
// Una Sim por empresa: su horario, su tiempo, su carga de trabajo y su política de teletrabajo.
//
// v2: cada día cada uno trabaja en la oficina o en casa (lo decide al despertar, a las 08:30,
// con tope por reglas), va y vuelve por la calle, solo oye lo que pasa cerca, llama a
// compañeros o a gente de fuera, piensa cosas que solo ve su dueño y tiene estados de 0 a 5.

const clockLib = require('./clock');
const { parts, blockOf, phaseOf, isWorkday, dreamWindowOpen, nextMorning, addDays } = clockLib;
const { ACTION_FOR_PLACE, targetFor, zonePos, zoneSpot, deskPos, ZONES } = require('./places');
const { visitorsFor } = require('./visitors');
const { autopilotPlan } = require('./autopilot');
const gm = require('./gameMaster');
const stats = require('./stats');
const { heardBy } = require('./hearing');
const weatherLib = require('./weather');
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
const DEFAULT_REMOTE_PER_WEEK = 2;
const MAX_CAST = 12; // compañeros que van en el prompt: su equipo, los C-suite y poco más
const WORKLOAD_TEXT = ['tranquila', 'normal', 'alta', 'a tope'];
const MAX_HEARD = 8;

class Sim {
  constructor({ pool, io, clock, companyId = 1, tickMs = 1000 }) {
    this.pool = pool;
    this.io = io;
    this.baseClock = clock;
    this.clock = clock; // el de la empresa: el común, o el movido en modo pruebas (loadCompany)
    this.companyId = companyId;
    this.room = `company:${companyId}`;
    this.sch = clockLib.makeSchedule();
    this.weather = new weatherLib.Weather(pool, companyId);
    this.company = { name: '', settings: {} };
    this.tickMs = tickMs;
    this.plans = new Map(); // `${id}|${day}|${block}` -> actions
    this.days = new Map(); // `${id}|${day}` -> { mode, ida, vuelta }
    this.ensured = new Set(); // turnos ya pedidos o descartados
    this.current = new Map(); // id -> {key, action, bubbleUntil}
    this.notified = new Set(); // avisos de una sola vez (tope gastado)
    this.chars = [];
    this.lastLoad = 0;
    this.running = false;
  }

  async loadCompany() {
    const r = await this.pool.query('SELECT name, visibility, settings FROM companies WHERE id = $1', [this.companyId]);
    if (!r.rows[0]) return null;
    this.company = r.rows[0];
    this.clock = clockLib.shiftedClock(this.baseClock, this.company.settings.reloj);
    const h = this.company.settings.hours;
    if (h && this.sch.set(h)) console.error(`empresa ${this.companyId}: horario guardado no válido`);
    return this.company;
  }

  async start() {
    await this.loadCompany();
    this.weather.start();
    this.timer = setInterval(() => {
      if (this.running) return;
      this.running = true;
      this.tick().catch(e => console.error('tick:', e)).finally(() => { this.running = false; });
    }, this.tickMs);
  }

  stop() {
    clearInterval(this.timer);
    this.weather.stop();
  }

  // Piensan con IA las personas y los C-suite; el resto de ficticios, en piloto automático.
  aiFor(c) {
    if (c.sin_ia) return false; // jugador de prueba sin IA (modo pruebas)
    return c.owner_user_id != null || c.csuite === true;
  }

  now() {
    return parts(this.clock.nowMs());
  }

  async loadCharacters(force = false) {
    if (!force && Date.now() - this.lastLoad < 5000) return this.chars;
    const r = await this.pool.query(
      `SELECT c.*, COALESCE(u.avatar_config, c.avatar_config) AS avatar,
              p.title AS position_title, p.csuite, p.place, p.parent_id AS position_parent,
              COALESCE(c.owner_user_id, (SELECT user_id FROM memberships WHERE company_id = c.company_id AND role = 'admin'
                                          ORDER BY joined_at LIMIT 1)) AS payer
         FROM characters c
         LEFT JOIN users u ON u.id = c.owner_user_id
         LEFT JOIN positions p ON p.id = c.position_id
        WHERE c.company_id = $1 AND c.approved AND NOT c.paused AND NOT c.retired ORDER BY c.id`,
      [this.companyId],
    );
    this.chars = r.rows.map(c => ({ ...c, stats: stats.normalize(c.stats) }));
    this.lastLoad = Date.now();
    return this.chars;
  }

  invalidate() {
    this.lastLoad = 0;
  }

  weatherNow() {
    return this.weather ? this.weather.current : null;
  }

  // Los compañeros que entran en el prompt: C-suite, su jefe, sus compañeros de equipo y sus
  // subordinados (hasta MAX_CAST). Con 50 personas, no se manda la lista entera.
  relevantCast(c, cast) {
    const pick = cast.filter(x => x.id === c.id || x.csuite
      || (x.position_id && x.position_id === c.position_parent)
      || (x.position_parent && x.position_parent === c.position_parent)
      || (x.position_parent && x.position_parent === c.position_id));
    const rest = cast.filter(x => !pick.includes(x));
    return [...pick, ...rest].slice(0, MAX_CAST + 1);
  }

  async workload(day) {
    const r = await this.pool.query('SELECT level, note FROM workload WHERE company_id = $1 AND day = $2', [this.companyId, day]);
    return r.rows[0] || { level: 1, note: null };
  }

  weatherLine(day) {
    const lat = this.weather ? this.weather.location.lat : 40;
    return weatherLib.promptLine(this.weatherNow(), weatherLib.season(day, lat));
  }

  // --- el día de cada uno: oficina o casa, y sus trayectos ---

  async dayOf(c, day) {
    const key = `${c.id}|${day}`;
    if (this.days.has(key)) return this.days.get(key);
    let r = await this.pool.query('SELECT mode, ida, vuelta, extra FROM day_status WHERE character_id = $1 AND day = $2', [c.id, day]);
    if (!r.rows.length) {
      // Primer momento del día: ha dormido y desayunado.
      await this.pool.query(
        `INSERT INTO day_status (character_id, day, mode) VALUES ($1, $2, 'oficina') ON CONFLICT DO NOTHING`, [c.id, day]);
      await this.saveStats(c, stats.morning(c.stats));
      r = await this.pool.query('SELECT mode, ida, vuelta, extra FROM day_status WHERE character_id = $1 AND day = $2', [c.id, day]);
    }
    this.days.set(key, r.rows[0]);
    return r.rows[0];
  }

  async setDay(c, day, patch) {
    const cur = await this.dayOf(c, day);
    const next = { ...cur, ...patch };
    await this.pool.query('UPDATE day_status SET mode = $3, ida = $4, vuelta = $5, extra = $6 WHERE character_id = $1 AND day = $2',
      [c.id, day, next.mode, next.ida, next.vuelta, !!next.extra]);
    this.days.set(`${c.id}|${day}`, next);
    return next;
  }

  // Tope por reglas: como mucho MAX_REMOTE_PER_WEEK días en casa por semana (lunes a viernes).
  // Política de la empresa: días de teletrabajo por semana y días de oficina obligatorios.
  async canRemote(c, day, weekday) {
    const set = this.company.settings || {};
    const perWeek = Number.isInteger(set.remotePerWeek) ? set.remotePerWeek : DEFAULT_REMOTE_PER_WEEK;
    if (perWeek <= 0 || (Array.isArray(set.officeDays) && set.officeDays.includes(weekday))) return false;
    const monday = addDays(day, -(weekday - 1));
    const r = await this.pool.query(
      `SELECT COUNT(*)::int AS n FROM day_status WHERE character_id = $1 AND day >= $2 AND day < $3 AND mode = 'remoto'`,
      [c.id, monday, day]);
    return r.rows[0].n < perWeek;
  }

  // Horas extra: solo con carga alta o a tope (la marca el admin de la empresa).
  async canExtra(c, day) {
    return (await this.workload(day)).level >= 2;
  }

  async saveStats(c, next) {
    c.stats = stats.normalize(next);
    await this.pool.query('UPDATE characters SET stats = $2 WHERE id = $1', [c.id, JSON.stringify(c.stats)]);
  }

  async getPlan(c, day, block) {
    const key = `${c.id}|${day}|${block}`;
    if (this.plans.has(key)) return this.plans.get(key);
    let r = await this.pool.query(
      'SELECT actions FROM plans WHERE character_id = $1 AND day = $2 AND block = $3', [c.id, day, block]);
    if (!r.rows.length) {
      const { mode } = await this.dayOf(c, day);
      const actions = autopilotPlan(c, day, block, { remote: mode === 'remoto', sch: this.sch });
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

  async dayActions(c, day) {
    const r = await this.pool.query('SELECT actions FROM plans WHERE character_id = $1 AND day = $2 ORDER BY block', [c.id, day]);
    return r.rows.flatMap(x => x.actions).sort((a, b) => a.min - b.min);
  }

  // Lo que ha visto u oído un personaje un día (y hasta un minuto), sin lo que hizo él mismo.
  async heard(c, day, untilMin = 24 * 60) {
    const [events, plan, d] = await Promise.all([
      this.pool.query(
        `SELECT id, character_id, con_id, lugar, min, text, kind, private FROM feed
          WHERE company_id = $3 AND office_day = $1 AND kind IN ('accion', 'llamada', 'visita')
            AND (min IS NULL OR min <= $2) ORDER BY id`,
        [day, untilMin, this.companyId]),
      this.dayActions(c, day),
      this.pool.query('SELECT mode FROM day_status WHERE character_id = $1 AND day = $2', [c.id, day]),
    ]);
    const mode = d.rows[0] ? d.rows[0].mode : 'oficina';
    return heardBy(events.rows, { id: c.id, mode }, plan)
      .filter(e => e.character_id !== c.id && !e.private)
      .slice(-MAX_HEARD)
      .map(e => e.text);
  }

  async context(c, day) {
    const [diary, dream, prev] = await Promise.all([
      this.pool.query('SELECT text FROM diaries WHERE character_id = $1 AND day < $2 ORDER BY day DESC LIMIT 1', [c.id, day]),
      this.pool.query('SELECT text FROM dreams WHERE character_id = $1 AND morning = $2', [c.id, day]),
      this.pool.query('SELECT MAX(day) AS d FROM plans WHERE character_id = $1 AND day < $2', [c.id, day]),
    ]);
    return {
      yesterdayDiary: diary.rows[0] ? diary.rows[0].text : null,
      dream: dream.rows[0] ? dream.rows[0].text : null,
      prevDay: prev.rows[0] ? prev.rows[0].d : null,
    };
  }

  async request(kind, c, day, block, request) {
    const res = await turns.enqueue(this.pool, {
      kind, characterId: c.id, payerUserId: c.payer, day, block, model: c.model, request,
    });
    if (res.skipped === 'tope' && !this.notified.has(`${c.payer}|${day}`)) {
      this.notified.add(`${c.payer}|${day}`);
      await this.post(c, 'sistema', `💸 ${c.name} va en piloto automático: se ha gastado el tope de IA de hoy.`, day);
    }
    return res;
  }

  // Pide el turno que toque en este bloque, una sola vez.
  async ensureTurn(c, day, block, weekday) {
    const key = `${c.id}|${day}|${block}`;
    if (this.ensured.has(key)) return;
    this.ensured.add(key);
    if (!this.aiFor(c)) return; // ficticio sin IA: piloto automático
    const prev = await this.pool.query(
      `SELECT kind, block FROM turns WHERE character_id = $1 AND office_day = $2 AND kind IN ('despertar', 'tarde')
         AND status IN ('queued', 'running', 'done')`, [c.id, day]);
    const kinds = new Set(prev.rows.map(r => r.kind));
    let kind = null;
    if (!kinds.has('despertar')) kind = 'despertar';
    // Si se despertó ya por la tarde, ese turno ya planificó la tarde.
    else if (block === 'tarde' && !kinds.has('tarde') && !prev.rows.some(r => r.kind === 'despertar' && r.block === 'tarde')) kind = 'tarde';
    if (!kind) return;

    const cast = await this.loadCharacters();
    const ctx = await this.context(c, day);
    const d = await this.dayOf(c, day);
    // Al despertar recuerda lo que oyó ayer; por la tarde, lo de esta mañana.
    const heard = kind === 'despertar'
      ? (ctx.prevDay ? await this.heard(c, ctx.prevDay) : [])
      : await this.heard(c, day, this.sch.BLOCKS.tarde.from);
    let remoteRule = 'no';
    if (kind === 'despertar') remoteRule = (await this.canRemote(c, day, weekday)) ? 'puede' : 'no';
    else if (d.mode === 'remoto') remoteRule = 'remoto';
    const extraRule = block === 'tarde' && (await this.canExtra(c, day)) ? 'puede' : 'no';
    const wl = await this.workload(day);
    const workloadLine = wl.level === 1 && !wl.note ? '' : `Carga de trabajo hoy: ${WORKLOAD_TEXT[wl.level]}${wl.note ? ` (${wl.note})` : ''}.`;
    const request = prompts.planRequest({
      kind, character: c, cast: this.relevantCast(c, cast), day, block, yesterdayDiary: ctx.yesterdayDiary, heard,
      dream: kind === 'despertar' ? ctx.dream : null, weatherLine: this.weatherLine(day), remoteRule, extraRule,
      sch: this.sch, workloadLine, company: this.company.name,
    });
    // Lo que el GM necesitará para validar la respuesta (ya decidido por reglas).
    request.rules = { canRemote: remoteRule === 'puede', remote: d.mode === 'remoto', canExtra: extraRule === 'puede' };
    await this.request(kind, c, day, block, request);
  }

  async ensureDiary(c, day) {
    const key = `${c.id}|${day}|diario`;
    if (this.ensured.has(key)) return;
    this.ensured.add(key);
    if (!this.aiFor(c)) return;
    const todayActions = await this.dayActions(c, day);
    if (!todayActions.length) return;
    const done = await this.pool.query('SELECT 1 FROM diaries WHERE character_id = $1 AND day = $2', [c.id, day]);
    if (done.rows.length) return;
    const cast = await this.loadCharacters();
    const d = await this.dayOf(c, day);
    const heard = await this.heard(c, day);
    const request = prompts.diaryRequest({
      character: c, cast: this.relevantCast(c, cast), day, todayActions, heard, mode: d.mode, weatherLine: this.weatherLine(day),
    });
    await this.request('diario', c, day, null, request);
  }

  // Al feed. Lo privado (pensamientos) solo le llega al dueño del personaje (o al admin, si no tiene).
  async post(c, kind, text, day, meta = {}) {
    const r = await this.pool.query(
      `INSERT INTO feed (company_id, character_id, kind, text, office_day, lugar, con_id, externo, min, private)
       VALUES ($10, $1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, company_id, character_id, kind, text, created_at, lugar, con_id, externo, min, private, office_day`,
      [c ? c.id : null, kind, text, day, meta.lugar || null, meta.con || null, meta.externo || null,
        meta.min == null ? null : meta.min, !!meta.private, this.companyId]);
    const row = r.rows[0];
    if (row.private) {
      const ownerId = c.owner_user_id || c.payer;
      if (ownerId) this.io.to(`user:${ownerId}`).emit('feed', row);
    } else {
      this.io.to(this.room).emit('feed', row);
    }
  }

  async tick() {
    const p = this.now();
    const block = blockOf(p, this.sch);
    const phase = phaseOf(p, this.sch);
    const day = p.date;
    const B = this.sch.BLOCKS;
    await turns.maintain(this.pool, { day, block, minutes: p.minutes, sch: this.sch, companyId: this.companyId });
    const chars = await this.loadCharacters();
    const cast = chars;
    const view = [];

    for (const c of chars) {
      const workday = isWorkday(p.weekday);
      // Quien hace horas extra sigue con su tarde (alargada) hasta las 20:00.
      const inExtra = workday && p.minutes >= B.extra.from && p.minutes < B.extra.to
        && (await this.dayOf(c, day)).extra;
      if (block === 'noche' && !inExtra) {
        this.current.delete(c.id);
        // A las 08:30, antes de salir de casa, se despierta y decide el día.
        if (phase === 'ida') {
          await this.dayOf(c, day);
          await this.ensureTurn(c, day, 'manana', p.weekday);
        }
        const d = workday && p.minutes >= this.sch.COMMUTE.ida ? await this.dayOf(c, day) : null;
        const leaves = d && d.extra ? B.extra.to : B.tarde.to;
        if (workday && p.minutes >= leaves) await this.ensureDiary(c, day);
        view.push(this.viewOf(c, null, cast, { phase: charPhase(p, phase, d, this.sch), day: d }));
        continue;
      }
      const d = await this.dayOf(c, day);
      const workBlock = inExtra ? 'tarde' : block;
      const actions = await this.getPlan(c, day, workBlock);
      await this.ensureTurn(c, day, workBlock, p.weekday);
      let idx = 0;
      for (let i = 0; i < actions.length; i++) if (actions[i].min <= p.minutes) idx = i;
      const a = actions[idx];
      const key = `${day}|${workBlock}|${idx}|${a.que}`;
      const cur = this.current.get(c.id);
      if (!cur || cur.key !== key) {
        const bubbleUntil = a.frase ? Date.now() + BUBBLE_MS : 0;
        this.current.set(c.id, { key, action: a, bubbleUntil });
        if (cur) await this.onActionStart(c, a, cast, day, d);
      }
      view.push(this.viewOf(c, this.current.get(c.id), cast, { phase, day: d }));
    }
    linkCalls(view);
    spreadZones(view);
    if (isWorkday(p.weekday)) view.push(...(await this.visitorViews(day, p.minutes, chars)));

    const loc = this.weather ? this.weather.location : weatherLib.DEFAULT_LOCATION;
    const w = this.weatherNow();
    this.io.to(this.room).emit('world', {
      company: { id: this.companyId, name: this.company.name },
      clock: {
        date: day, hhmm: p.hhmm, weekday: p.weekday, block, phase,
        // Franja del trayecto en curso y horario, para que la calle y la UI no supongan 9-18.
        commute: phase === 'ida' ? { from: this.sch.COMMUTE.ida, to: B.manana.from }
          : phase === 'vuelta' ? { from: B.tarde.to, to: this.sch.COMMUTE.vuelta } : null,
        schedule: { start: clockLib.fromMinutes(this.sch.SCHEDULE.start), end: clockLib.fromMinutes(this.sch.SCHEDULE.end) },
        dreamOpen: dreamWindowOpen(p, this.sch), nextMorning: nextMorning(p, this.sch),
        weather: w ? { temp: w.temp, code: w.code, desc: w.desc, precip: w.precip, wind: w.wind, isDay: w.isDay } : null,
        season: weatherLib.season(day, loc.lat),
        city: loc.city,
        // Modo pruebas: la empresa va con el reloj movido (se avisa en pantalla).
        test: this.clock.shifted ? { speed: this.clock.speed / this.baseClock.speed } : null,
      },
      characters: view,
    });
  }

  // Visitantes del día que están ahora en la oficina; al llegar, se anuncian en el feed.
  async visitorViews(day, minutes, chars) {
    const out = [];
    for (const [i, e] of visitorsFor(day, this.companyId, this.sch, chars).entries()) {
      if (minutes < e.from || minutes >= e.to) continue;
      const fresh = !this.ensured.has(`visita|${e.key}`);
      if (fresh) {
        this.ensured.add(`visita|${e.key}`);
        await this.post(null, 'visita', `${e.kind === 'repartidor' ? '📦' : e.kind === 'limpieza' ? '🧹' : '🔧'} ${e.name}: ${e.que} — «${e.frase}»`, day,
          { lugar: e.place, con: e.forId || null, min: e.from });
      }
      // La limpieza va de mesa en mesa por el open space; los demás, en su sitio.
      const pos = e.place === 'mesa'
        ? (d => ({ x: d.x + 30, y: d.y + 44 }))(deskPos(Math.floor((minutes - e.from) / 4)))
        : zonePos(e.place, 90 + i);
      out.push({
        id: -(i + 1), name: e.name, owner_user_id: null, avatar_config: e.avatar, visitor: { kind: e.kind, forId: e.forId || null },
        home: false, mode: 'oficina', x: pos.x, y: pos.y, lugar: e.place, que: e.que, action: 'paseando',
        representation: null, bubble: minutes - e.from < 5 ? e.frase : null, call: null, trayecto: null, stats: null,
      });
    }
    return out;
  }

  async onActionStart(c, a, cast, day, d) {
    await this.saveStats(c, stats.applyAction(c.stats, a, { weather: this.weatherNow(), sch: this.sch }));
    const cafe = a.lugar === 'cafe' ? Math.min(10, c.cafe + 4) : Math.max(0, c.cafe - 1);
    c.cafe = cafe;
    await this.pool.query('UPDATE characters SET cafe = $2 WHERE id = $1', [c.id, cafe]);

    const con = a.con ? cast.find(x => x.id === a.con) : null;
    // Llamada: quien teletrabaja y habla con un compañero, o cualquiera con alguien de fuera.
    const isCall = !!a.externo || (con && (d.mode === 'remoto' || (this.days.get(`${con.id}|${day}`) || {}).mode === 'remoto'));
    const who = con ? con.name : a.externo;
    const text = `${isCall ? '📞 ' : ''}${c.name}: ${a.que}${who ? ` (${isCall ? 'llamada con' : 'con'} ${who})` : ''}${a.frase ? ` — «${a.frase}»` : ''}`;
    await this.post(c, isCall ? 'llamada' : 'accion', text, day, { lugar: a.lugar, con: a.con, externo: a.externo, min: a.min });
    if (a.piensa) await this.post(c, 'pensamiento', a.piensa, day, { lugar: a.lugar, min: a.min, private: true });
  }

  viewOf(c, cur, cast, { phase, day: d }) {
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
      stats: c.stats,
      position: c.position_id ? { id: c.position_id, title: c.position_title, csuite: !!c.csuite } : null,
      npc: c.owner_user_id == null,
      call: null,
      trayecto: null,
    };
    if (!cur) {
      // Fuera del horario: de camino (si va a la oficina ese día) o en casa.
      if (d && d.mode === 'oficina' && (phase === 'ida' || phase === 'vuelta')) {
        return { ...base, home: false, mode: phase, trayecto: phase === 'ida' ? d.ida : d.vuelta };
      }
      return { ...base, home: true, mode: 'casa' };
    }
    const a = cur.action;
    const bubble = cur.bubbleUntil > Date.now() ? a.frase : null;
    if (d && d.mode === 'remoto') {
      return {
        ...base, home: false, mode: 'remoto', lugar: 'casa', que: a.que, bubble,
        action: ACTION_FOR_PLACE.casa || 'sentado',
        representation: HUMOR_REPR[c.humor] || null,
        call: a.con || a.externo ? { with: a.con || null, externo: a.externo || null } : null,
      };
    }
    const withDesk = a.con && cast ? (cast.find(x => x.id === a.con) || {}).desk_index : null;
    const lugar = a.lugar === 'mesa' && withDesk != null ? 'visita' : a.lugar;
    // Quien tiene despacho o mostrador, «en su mesa» está allí.
    const own = a.lugar === 'mesa' && withDesk == null && c.place && c.place !== 'mesa';
    const pos = own ? zonePos(c.place, c.id) : targetFor({ lugar: a.lugar, deskIndex: c.desk_index, withDeskIndex: withDesk, slot: c.id });
    return {
      ...base,
      home: false,
      mode: 'oficina',
      x: pos.x,
      y: pos.y,
      lugar,
      que: a.que,
      action: c.stats.energia <= 0.5 ? 'durmiendo' : ACTION_FOR_PLACE[lugar],
      representation: HUMOR_REPR[c.humor] || null,
      bubble,
      call: a.externo ? { with: null, externo: a.externo } : null,
      ...(own ? { ownSpot: true } : {}),
    };
  }

  // --- Resultados de la IA ---

  async applyTurn(turn) {
    const c = (await this.loadCharacters(true)).find(x => x.id === turn.character_id)
      || (await this.pool.query('SELECT * FROM characters WHERE id = $1', [turn.character_id])).rows[0];
    if (!c) return;
    c.stats = stats.normalize(c.stats);
    const out = turn.result;
    const day = turn.office_day;
    if (turn.kind === 'despertar' || turn.kind === 'tarde') {
      const rules = (turn.request && turn.request.rules) || {};
      const v = gm.validateWake(out, {
        block: turn.block, names: this.chars, selfId: c.id,
        sch: this.sch,
        decideMode: turn.kind === 'despertar', canRemote: rules.canRemote === true, remote: rules.remote === true,
        canExtra: rules.canExtra === true,
      });
      if (turn.kind === 'despertar') await this.applyMode(c, day, v);
      if (turn.block === 'tarde' && v.extra) {
        await this.setDay(c, day, { extra: true });
        await this.post(c, 'trayecto', `🌙 ${c.name} hoy se queda haciendo horas extra.`, day, { min: this.sch.BLOCKS.tarde.to });
      }
      await this.mergePlan(c, day, turn.block, v.plan);
      await this.pool.query('UPDATE characters SET humor = $2 WHERE id = $1', [c.id, v.humor]);
      await this.saveStats(c, stats.applyHumor(c.stats, v.humor));
      if (turn.kind === 'despertar' && v.sueno) await this.applyDream(c, day, v.sueno);
    } else if (turn.kind === 'diario') {
      const v = gm.validateDiary(out);
      await this.pool.query(
        `INSERT INTO diaries (character_id, day, text) VALUES ($1, $2, $3)
         ON CONFLICT (character_id, day) DO UPDATE SET text = EXCLUDED.text`, [c.id, day, v.diario]);
      await this.pool.query('UPDATE characters SET humor = $2 WHERE id = $1', [c.id, v.humor]);
      await this.saveStats(c, stats.applyHumor(c.stats, v.humor));
      const d = await this.dayOf(c, day);
      if (d.mode === 'oficina' && v.trayecto) {
        await this.setDay(c, day, { vuelta: v.trayecto });
        const leftAt = d.extra ? this.sch.BLOCKS.extra.to : this.sch.BLOCKS.tarde.to;
        await this.post(c, 'trayecto', `🚶 ${c.name}, volviendo a casa: ${v.trayecto}`, day, { min: leftAt });
      }
      await this.post(c, 'diario', `📔 ${c.name} ha escrito su diario.`, day);
    } else if (turn.kind === 'perfil') {
      const ficha = gm.validateProfile(out);
      await this.pool.query('UPDATE characters SET ficha = $2 WHERE id = $1', [c.id, ficha]);
    } else if (turn.kind === 'sueno_ayuda') {
      gm.validateDreamHelp(out); // el resultado se lee desde el turno
    }
    this.invalidate();
  }

  // Dónde trabaja hoy y qué le pasó de camino. Si cambia a casa, el plan de piloto
  // automático de la tarde (si ya existía) se rehace en casa.
  async applyMode(c, day, v) {
    const before = await this.dayOf(c, day);
    await this.setDay(c, day, { mode: v.mode, ida: v.mode === 'oficina' ? (v.trayecto || null) : null });
    if (v.mode === 'remoto') {
      await this.post(c, 'trayecto', `🏠 ${c.name} hoy teletrabaja desde casa.`, day, { min: this.sch.COMMUTE.ida });
    } else if (v.trayecto) {
      await this.post(c, 'trayecto', `🚶 ${c.name}, de camino a la oficina: ${v.trayecto}`, day, { min: this.sch.COMMUTE.ida });
    }
    if (before.mode !== v.mode) {
      const r = await this.pool.query(
        `DELETE FROM plans WHERE character_id = $1 AND day = $2 AND source = 'autopiloto' RETURNING block`, [c.id, day]);
      for (const row of r.rows) this.plans.delete(`${c.id}|${day}|${row.block}`);
    }
  }

  // Lo ya vivido se queda; lo que la IA planea a partir de ahora sustituye al piloto automático.
  async mergePlan(c, day, block, iaActions) {
    const p = this.now();
    // La tarde con horas extra sigue «en vivo» hasta las 20:00.
    const B = this.sch.BLOCKS;
    const live = p.date === day && (blockOf(p, this.sch) === block || (block === 'tarde' && p.minutes >= B.tarde.from && p.minutes < B.extra.to));
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
    await this.post(c, 'sueno', `💭 ${c.name} se despierta tras un sueño raro y ${verbo}: «${sueno.por_que}»`, day);
  }
}

// Fase de cada uno: quien hace horas extra sigue en la oficina hasta las 20:00 y vuelve después.
function charPhase(p, phase, d, sch = clockLib.DEFAULT) {
  if (!d || !d.extra) return phase;
  const m = p.minutes;
  const { BLOCKS } = sch;
  if (m >= BLOCKS.extra.from && m < BLOCKS.extra.to) return 'oficina';
  if (m >= BLOCKS.extra.to && m < BLOCKS.extra.to + 30) return 'vuelta';
  return phase === 'vuelta' ? 'casa' : phase;
}

// Reparte a quien está en cada zona en huecos seguidos (por id, estable), para que no se monten
// aunque haya mucha gente (con 15 ficticios la cocina se llenaba).
function spreadZones(view) {
  const byZone = new Map();
  for (const v of view) {
    if (v.mode !== 'oficina' || v.visitor || !ZONES[v.lugar] || v.ownSpot) continue;
    if (!byZone.has(v.lugar)) byZone.set(v.lugar, []);
    byZone.get(v.lugar).push(v);
  }
  for (const [zone, list] of byZone) {
    list.sort((a, b) => a.id - b.id).forEach((v, k) => Object.assign(v, zoneSpot(zone, k)));
  }
}

// Las videollamadas van en las dos direcciones: si alguien de casa llama a uno de la oficina,
// a ese también se le pinta la llamada (si no está ya en otra).
function linkCalls(view) {
  const byId = new Map(view.map(v => [v.id, v]));
  for (const v of view) {
    if (!v.call || !v.call.with) continue;
    const other = byId.get(v.call.with);
    if (other && !other.home && !other.call) other.call = { with: v.id, externo: null };
  }
}

module.exports = { Sim, HUMOR_REPR, addDays, linkCalls, charPhase, spreadZones };
