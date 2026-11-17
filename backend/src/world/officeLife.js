// La vida de la oficina más allá de cada personaje: incidentes con estado (incidents.js) y eventos
// (events.js). Una instancia por empresa, dentro de su Sim. Cada minuto de oficina:
//   - cierra lo que se pasa solo, lo que alguien arregla y lo que arregla el técnico;
//   - tira los dados de los incidentes posibles en esta oficina y en este momento;
//   - prepara los eventos del día (los automáticos y los del admin).
// Todo deja rastro en el feed (kind 'incidente' / 'evento'), que es lo que los personajes «oyen».

const clockLib = require('./clock');
const incidents = require('./incidents');
const events = require('./events');
const outside = require('./outside');
const { rng } = require('./autopilot');
const { INCIDENT_OBJECTS } = require('./places');
const mudanza = require('./mudanza');
const layouts = require('./layout');
const tramas = require('./tramas');
const stats = require('./stats');

const TECH_STAY = 40; // minutos que tarda el técnico
const MAX_CATCH_UP = 30; // minutos que se recuperan si el reloj va rápido

const roomOf = l => (l === 'mesa' ? 'openspace' : l);

function nextWorkday(day) {
  let d = clockLib.addDays(day, 1);
  while (!clockLib.isWorkday(clockLib.parts(clockLib.madridMs(d, '12:00')).weekday)) d = clockLib.addDays(d, 1);
  return d;
}

class OfficeLife {
  constructor(sim) {
    this.sim = sim;
    this.active = [];
    this.events = [];
    this.eventsDay = null;
    this.lastMin = null;
    this.lastDay = null;
    this.reacted = new Set();
    this.announced = new Set();
    this.fallbackTypes = new Set(INCIDENT_OBJECTS);
    this.outside = []; // sucesos de fuera de hoy: [{ row, def }]
    this.outsideDay = null;
    this.outsideRolled = false;
    this.crews = new Map();
    this.plots = []; // tramas en marcha (filas de office_plots)
    this.rels = new Map(); // 'a>b' -> { roce, aprecio }
    this.relDay = null;
    this.scenes = new Map(); // id de personaje -> { day, until, lugar, que, frase, con }
    this.plotsToday = null; // { day, n }
    this.here = [];
  }

  get pool() { return this.sim.pool; }
  get companyId() { return this.sim.companyId; }

  async load() {
    this.active = (await this.pool.query(
      'SELECT * FROM office_incidents WHERE company_id = $1 AND resolved_day IS NULL ORDER BY id', [this.companyId])).rows;
    this.plots = (await this.pool.query(
      'SELECT * FROM office_plots WHERE company_id = $1 AND ended_day IS NULL ORDER BY id', [this.companyId])).rows;
  }

  async loadEvents(day, weekday, chars) {
    if (clockLib.isWorkday(weekday)) {
      for (const e of events.autoEvents(day, weekday, chars, this.sim.sch, this.companyId)) {
        await this.pool.query(
          `INSERT INTO office_events (company_id, kind, title, place, day, from_min, to_min, auto)
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE) ON CONFLICT DO NOTHING`,
          [this.companyId, e.kind, e.title, e.place, day, e.from_min, e.to_min]);
      }
    }
    this.events = (await this.pool.query(
      'SELECT * FROM office_events WHERE company_id = $1 AND day = $2 AND NOT cancelled ORDER BY from_min', [this.companyId, day])).rows;
    // El cumpleañero, por nombre (los automáticos no guardan a quién).
    for (const e of this.events) {
      if (e.kind === 'cumple') {
        const c = chars.find(x => e.title.startsWith(`Cumple de ${x.name} `));
        if (c) e.forId = c.id;
      }
    }
    this.eventsDay = day;
  }

  invalidateEvents() { this.eventsDay = null; }

  // working: [{ c, d, a0 }] de los que están ahora en su jornada. block: bloque del día.
  async minute(day, p, working, chars, block) {
    if (this.lastDay !== day) { this.lastDay = day; this.lastMin = null; this.reacted.clear(); await this.load(); }
    if (this.eventsDay !== day) await this.loadEvents(day, p.weekday, chars);
    if (this.lastMin === p.minutes) return;
    const from = this.lastMin == null ? p.minutes : Math.max(this.lastMin + 1, p.minutes - MAX_CATCH_UP);
    this.lastMin = p.minutes;
    const here = working.filter(w => w.d.mode === 'oficina');
    this.here = here;
    await this.loadRelations(day);
    for (let m = from; m <= p.minutes; m++) {
      await this.closeDue(day, m, here);
      if (block === 'manana' || block === 'tarde') {
        await this.rollAt(day, m, here);
        await this.plotsTick(day, m, here, block);
      }
      await this.announceEvents(day, m);
      await this.announceOutside(day, m);
    }
  }

  async closeDue(day, m, here) {
    for (const inc of this.active.slice()) {
      const def = incidents.BY_KIND[inc.kind];
      if (!def) continue;
      const startedBefore = inc.started_day < day || (inc.started_day === day && inc.started_min <= m);
      if (!startedBefore) continue;
      if (inc.repair === 'tiempo' && inc.ends_day && (inc.ends_day < day || (inc.ends_day === day && inc.ends_min <= m))) {
        const by = here.length ? here[Math.floor(rng(`fix|${inc.id}`)() * here.length)].c : null;
        await this.resolve(inc, by, day, m);
      } else if (inc.repair === 'alguien') {
        const waited = inc.started_day < day ? Infinity : m - inc.started_min;
        if (waited >= incidents.ALGUIEN_MAX_MIN && here.length) {
          const manitas = here.filter(w => incidents.traits(w.c).manitas);
          const pool = manitas.length ? manitas : here;
          await this.resolve(inc, pool[Math.floor(rng(`fix|${inc.id}`)() * pool.length)].c, day, m);
        }
      } else if (inc.repair === 'tecnico') {
        const t = inc.data.tecnico;
        if (t && (t.day < day || (t.day === day && m >= t.min + TECH_STAY))) await this.resolve(inc, null, day, m);
      }
    }
  }

  async rollAt(day, m, here) {
    const sch = this.sim.sch;
    const w = this.sim.weatherNow();
    const ctx = {
      // Lo que tiene esta oficina: si no hay cafetera, no se rompe la cafetera.
      companyId: this.companyId, day, min: m, mapTypes: this.sim.layout ? this.sim.layout.objectTypes : this.fallbackTypes, active: this.active,
      places: this.sim.layout ? this.sim.layout.places : null,
      lunch: m >= sch.SCHEDULE.lunch - 15 && m <= sch.SCHEDULE.lunch + sch.SCHEDULE.lunchMin,
      windy: !!(w && Number(w.wind) >= 25), storm: !!(w && w.code >= 95), hot: !!(w && w.temp >= 28),
      cold: !!(w && w.temp <= 8), morning: m < sch.BLOCKS.manana.to,
      startedToday: await this.startedToday(day),
      // Lo de fuera también cuenta: con ola de calor el aire se rompe más; con nieve, la calefacción.
      ...(this.outside.some(o => o.def.kind === 'ola_calor') ? { hot: true } : {}),
      ...(this.outside.some(o => o.def.kind === 'nevada') ? { cold: true } : {}),
      inPlace: place => here.filter(x => place == null || roomOf(x.a0.lugar) === roomOf(place)).map(x => x.c),
      // La broma pesada le toca, más a menudo, a quien ya se le tiene manía (relaciones de tramas.js).
      pickVictim: (cause, others, r) => {
        if (cause && r() < 0.6) {
          const top = others.map(o => ({ o, roce: this.rel(cause, o).roce })).sort((a, b) => b.roce - a.roce)[0];
          if (top && top.roce >= 0.2) return top.o;
        }
        return others[Math.floor(r() * others.length)];
      },
    };
    for (const n of incidents.roll(ctx)) await this.start(n.def, n.cause, n.victim, day, m, n.endsMin);
  }

  async startedToday(day) {
    if (this.countDay !== day) {
      this.countDay = day;
      this.count = (await this.pool.query(
        `SELECT COUNT(*)::int AS n FROM office_incidents WHERE company_id = $1 AND started_day = $2 AND NOT (data ? 'pequeno')`,
        [this.companyId, day])).rows[0].n;
    }
    return this.count;
  }

  // Abre un incidente (también lo usa el modo pruebas para provocarlo).
  async start(def, cause, victim, day, m, endsMin = null, extra = {}) {
    let title = def.title(cause, victim);
    if (extra.frase) title += ` — «${extra.frase}»`;
    const data = { title, sign: def.sign || null, victim: victim ? victim.id : null, ...(def.small ? { pequeno: true } : {}) };
    if (def.repair === 'tecnico') {
      const tday = nextWorkday(day);
      data.tecnico = { day: tday, min: this.sim.sch.BLOCKS.manana.from + 60 + Math.floor(rng(`tec|${day}|${def.kind}`)() * 120) };
      title += ' Han llamado al técnico: viene el próximo día laborable.';
    }
    let endsDay = null;
    if (endsMin != null) {
      endsDay = day;
      if (endsMin >= 24 * 60) { endsDay = clockLib.addDays(day, 1); endsMin -= 24 * 60; }
    }
    const inc = (await this.pool.query(
      `INSERT INTO office_incidents (company_id, kind, place, cause_character, started_day, started_min, ends_day, ends_min, repair, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [this.companyId, def.kind, def.place, cause ? cause.id : null, day, m, endsDay, endsMin, def.repair, data])).rows[0];
    this.active.push(inc);
    this.count = (this.count || 0) + 1;
    await this.sim.post(cause || null, 'incidente', title, day, { lugar: def.everywhere ? null : def.place, min: m });
    // Causa → consecuencia: algunos incidentes arrancan una trama (tramas.js).
    if (!def.small) {
      const x = this.plotCtx(day, m, this.here, `inc|${inc.id}`);
      const spec = tramas.fromIncident({ kind: def.kind, cause, victim }, x, this.plots);
      if (spec) await this.startPlot(spec, day, m, `incidente:${def.kind}`);
    }
    return inc;
  }

  async resolve(inc, by, day, m) {
    const def = incidents.BY_KIND[inc.kind];
    const victim = inc.data.victim ? (this.sim.chars.find(c => c.id === inc.data.victim) || null) : null;
    const text = def.fixed(by, victim);
    await this.pool.query(
      'UPDATE office_incidents SET resolved_day = $2, resolved_min = $3, resolved_by = $4 WHERE id = $1',
      [inc.id, day, m, by ? by.name : (inc.repair === 'tecnico' ? 'técnico' : null)]);
    this.active = this.active.filter(x => x.id !== inc.id);
    await this.sim.post(by || null, 'incidente', text, day, { lugar: def.everywhere ? null : def.place, min: m });
  }

  // Alguien hace la escapada que lo arregla (recolocar el kanban, abrir la impresora…).
  async fixByMicro(c, microKind, day, m) {
    const inc = this.active.find(i => i.repair === 'alguien' && (incidents.BY_KIND[i.kind] || {}).fixWith === microKind);
    if (inc && rng(`fixm|${inc.id}|${c.id}|${m}`)() < 0.6) await this.resolve(inc, c, day, m);
  }

  effects() { return incidents.effects(this.active); }

  // Un percance que propuso la IA del personaje (y aceptó el Game Master) llega a su hora: las
  // reglas del momento (cupos, que no esté pasando ya, sitio cerrado) deciden si pasa de verdad.
  async startSmall(c, prop, day, m, mode) {
    const def = incidents.BY_KIND[prop && prop.tipo];
    const counts = (await this.pool.query(
      `SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE cause_character = $3)::int AS mine FROM office_incidents
        WHERE company_id = $1 AND started_day = $2 AND data ? 'pequeno'`, [this.companyId, day, c.id])).rows[0];
    const why = incidents.canStartSmall({
      def, mode, countToday: counts.n, charToday: counts.mine, active: this.active, closed: this.effects().closed,
    });
    if (why) return null;
    const dur = def.duration[0] + Math.floor(rng(`peq|${c.id}|${day}|${m}`)() * (def.duration[1] - def.duration[0]));
    return this.start(def, c, null, day, m, m + dur, { frase: prop.frase });
  }

  // --- Sucesos de fuera (outside.js) ---

  async loadOutside(day) {
    const rows = (await this.pool.query(
      'SELECT * FROM office_outside WHERE company_id = $1 AND day = $2 ORDER BY id', [this.companyId, day])).rows;
    this.outsideDay = day;
    this.outsideRolled = rows.length > 0;
    this.outside = rows.filter(r => outside.BY_KIND[r.kind]).map(row => ({ row, def: outside.BY_KIND[row.kind] }));
    this.crews = new Map();
  }

  // Cada tick, antes que nada: el suceso del día se tira una vez, media hora antes de salir de casa
  // (con el tiempo de verdad ya cargado; si no llega, a la hora de entrar, sin él).
  async outsideTick(day, p) {
    if (this.outsideDay !== day) await this.loadOutside(day);
    if (this.outsideRolled || !clockLib.isWorkday(p.weekday)) return;
    const sch = this.sim.sch;
    const w = this.sim.weatherNow();
    if (p.minutes < sch.COMMUTE.ida - 30 || (!w && p.minutes < sch.BLOCKS.manana.from)) return;
    this.outsideRolled = true;
    const region = require('./holidays').regionOf(this.sim.weather && this.sim.weather.location);
    const def = outside.rollDay(outside.dayContext(day, p.weekday, w, region), this.companyId);
    if (!def) {
      await this.pool.query(
        `INSERT INTO office_outside (company_id, day, kind) VALUES ($1, $2, 'nada') ON CONFLICT DO NOTHING`, [this.companyId, day]);
      return;
    }
    await this.startOutside(def, day, p.minutes);
  }

  // Empieza un suceso de fuera (también desde el modo pruebas, con forced: la franja empieza ya).
  async startOutside(def, day, m, { forced = false } = {}) {
    const sch = this.sim.sch;
    const mat = outside.materialize(def, { companyId: this.companyId, day, sch });
    if (forced && mat.from_min < m && (def.gather || def.fakeWork || def.phone)) {
      const len = mat.to_min - mat.from_min;
      mat.from_min = m + 1;
      mat.to_min = Math.min(m + 1 + len, 24 * 60 - 1);
    }
    const row = (await this.pool.query(
      `INSERT INTO office_outside (company_id, day, kind, from_min, to_min, forced, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING RETURNING *`,
      [this.companyId, day, def.kind, mat.from_min, mat.to_min, forced, { title: mat.title, prompt: mat.prompt }])).rows[0];
    if (!row) return null;
    if (this.outsideDay !== day) await this.loadOutside(day);
    else this.outside.push({ row, def });
    this.outsideRolled = true;
    this.crews = new Map();
    await this.sim.post(null, 'fuera', mat.title, day, { min: m });
    // Teletrabajo forzado y puente: a quien ya tenía el día empezado en la oficina, se le cambia.
    const chars = await this.sim.loadCharacters();
    const home = [];
    const away = [];
    for (const c of chars) {
      const own = outside.modeFor(def, row, c);
      if (!own) continue;
      (own === 'puente' ? away : home).push(c.name);
      const d = await this.sim.dayOf(c, day);
      if (d.mode === 'oficina') await this.sim.sendHome(c, day);
    }
    if (away.length) await this.sim.post(null, 'fuera', `🏖️ Se han cogido el puente: ${away.join(', ')}.`, day, { min: m });
    if (home.length) await this.sim.post(null, 'fuera', `🏠 Hoy teletrabajan a la fuerza: ${home.join(', ')}.`, day, { min: m });
    return row;
  }

  // 'remoto' | 'puente' | null: lo que el suceso de hoy le impone (para dayOf, el turno de IA y la vista).
  outsideMode(c, day) {
    if (this.outsideDay !== day) return null;
    for (const { row, def } of this.outside) {
      const own = outside.modeFor(def, row, c);
      if (own) return own;
    }
    return null;
  }

  // Hasta qué minuto viene de camino (llega tarde), o 0. Solo si el suceso empezó antes de entrar.
  lateUntil(c, day, d) {
    if (this.outsideDay !== day || !d || d.mode !== 'oficina') return 0;
    let until = 0;
    for (const { row, def } of this.outside) {
      const late = outside.lateMinutes(def, row, c);
      if (late) until = Math.max(until, this.sim.sch.BLOCKS.manana.from + late);
    }
    return until;
  }

  lateText(c) {
    const o = this.outside.find(({ row, def }) => outside.lateMinutes(def, row, c));
    return o ? o.def.late.text : null;
  }

  crewOf(row, def) {
    if (!this.crews.has(row.id)) this.crews.set(row.id, outside.phoneCrew(def, row, this.sim.chars));
    return this.crews.get(row.id);
  }

  // Qué hace ahora por culpa de lo de fuera (o null). d: su día; a0: su acción del plan.
  outsideFor(c, m, d, a0) {
    for (const { row, def } of this.outside) {
      const own = outside.modeFor(def, row, c);
      const o = outside.override(def, row, c, m, { mode: d.mode, own, onPhone: this.crewOf(row, def).has(c.id), lugar: a0.lugar });
      if (o) return o;
    }
    return null;
  }

  // Su reacción al suceso (una vez por persona), según su carácter.
  outsideReaction(c) {
    for (const { row, def } of this.outside) {
      const k = `fuera|${row.id}|${c.id}`;
      if (this.reacted.has(k)) continue;
      this.reacted.add(k);
      return outside.reaction(def, row, c, { onPhone: this.crewOf(row, def).has(c.id) });
    }
    return null;
  }

  // Lo que se cuenta a lo largo del día: la porra y el final de la franja.
  async announceOutside(day, m) {
    const sch = this.sim.sch;
    for (const { row, def } of this.outside) {
      const k = s => `fuera|${row.id}|${s}`;
      // La porra, a primera hora (o nada más provocarla en el modo pruebas).
      const porraAt = sch.BLOCKS.manana.from + 20;
      if (def.porra && m >= porraAt && !this.announced.has(k('porra')) && (m - porraAt < 5 || row.forced)) {
        this.announced.add(k('porra'));
        const text = outside.porra(row, this.sim.chars);
        if (text) await this.sim.post(null, 'fuera', text, day, { lugar: 'cafe', min: m });
      }
      if (def.end && m >= row.to_min && m - row.to_min < 5 && !this.announced.has(k('fin'))) {
        this.announced.add(k('fin'));
        await this.sim.post(null, 'fuera', def.end, day, { min: m });
      }
    }
  }

  // Visitantes que trae lo de fuera (el inspector), mientras dura su franja.
  outsideVisitors() {
    return this.outside.filter(o => o.def.visitor).map(({ row, def }) => ({
      key: `fuera|${row.id}`, from: row.from_min, to: row.to_min, icon: def.icon, ...def.visitor,
    }));
  }

  // Al llegar a un sitio con un incidente (o con uno de toda la oficina), lo comenta una vez.
  // Lo de fuera lo comenta cada uno una vez, esté donde esté (también desde casa).
  reactionFor(c, lugar, mode = 'oficina') {
    const ro = this.outsideReaction(c);
    if (ro || mode !== 'oficina') return ro;
    for (const inc of this.active) {
      const def = incidents.BY_KIND[inc.kind];
      if (!def) continue;
      if (!def.everywhere && roomOf(lugar) !== roomOf(inc.place)) continue;
      const k = `${inc.id}|${c.id}`;
      if (this.reacted.has(k)) continue;
      this.reacted.add(k);
      const r = rng(`reacc|${k}`);
      if (inc.cause_character === c.id || r() > 0.7) return null;
      return { text: incidents.reaction(inc.kind, r), stats: def.stats || null };
    }
    return null;
  }

  // Técnicos que vienen hoy (para visitorViews).
  technicians(day) {
    return this.active.filter(i => i.data.tecnico && i.data.tecnico.day === day).map(i => ({
      key: `tecnico|${i.id}`, kind: 'mantenimiento', place: i.place === 'oficina' ? 'recepcion' : i.place,
      from: i.data.tecnico.min, to: i.data.tecnico.min + TECH_STAY,
      que: `Viene a arreglar: ${String(i.data.title).replace(/^\S+\s/, '').split('.')[0].toLowerCase()}`,
      frase: '¿Dónde está el enfermo?',
    }));
  }

  // ¿Está en un evento ahora? → { place, title, frase, id } o null.
  eventFor(c, m) {
    for (const ev of this.events) {
      if (m < ev.from_min || m >= ev.to_min) continue;
      if (!events.attends(c, ev, c.stats)) continue;
      return { id: ev.id, place: events.placeFor(ev, this.sim.weatherNow()), title: ev.title, frase: events.phrase(ev, c, m) };
    }
    return null;
  }

  async announceEvents(day, m) {
    for (const ev of this.events) {
      const k = (s) => `${day}|${ev.id}|${s}`;
      const place = events.placeFor(ev, this.sim.weatherNow());
      const label = (events.KINDS[ev.kind] || events.KINDS.otro).icon;
      if (m >= ev.from_min && m < ev.to_min && !this.announced.has(k('ini'))) {
        this.announced.add(k('ini'));
        if (m - ev.from_min < 5) await this.sim.post(null, 'evento', `${label} Empieza: ${ev.title}${place !== ev.place ? ' (dentro, que fuera no se puede estar)' : ''}.`, day, { lugar: place, min: m });
      }
      if (m >= ev.to_min && !this.announced.has(k('fin')) && this.announced.has(k('ini'))) {
        this.announced.add(k('fin'));
        await this.sim.post(null, 'evento', `${label} Se acaba: ${ev.title}.`, day, { lugar: place, min: m });
      }
    }
  }

  // --- Tramas (tramas.js) ---

  rel(a, b) {
    return this.rels.get(tramas.relKey(a.id, b.id)) || { roce: 0, aprecio: 0 };
  }

  // Las relaciones, una vez por día (y ese día se olvida un poco lo de antes).
  async loadRelations(day) {
    if (this.relDay === day) return;
    this.relDay = day;
    await this.pool.query(
      `UPDATE relations SET roce = ROUND((roce * $3)::numeric, 2), aprecio = ROUND((aprecio * $4)::numeric, 2), day = $2
        WHERE company_id = $1 AND day < $2`, [this.companyId, day, 0.9, 0.95]);
    await this.pool.query('DELETE FROM relations WHERE company_id = $1 AND roce < 0.03 AND aprecio < 0.03', [this.companyId]);
    const rows = (await this.pool.query('SELECT a, b, roce, aprecio FROM relations WHERE company_id = $1', [this.companyId])).rows;
    this.rels = new Map(rows.map(r => [tramas.relKey(r.a, r.b), { roce: Number(r.roce), aprecio: Number(r.aprecio) }]));
  }

  // Lo que necesita un paso de trama para decidir: quién está, dónde, cómo es y cómo se llevan.
  plotCtx(day, m, here, seed) {
    const r = rng(`trama|${this.companyId}|${day}|${m}|${seed}`);
    const chars = this.sim.chars || [];
    const byId = new Map(chars.map(c => [c.id, c]));
    const inOffice = new Map(here.map(w => [w.c.id, w]));
    const where = c => {
      const sc = this.sceneFor(c, m, day);
      if (sc) return sc.lugar;
      const w = c && inOffice.get(c.id);
      return w ? w.a0.lugar : null;
    };
    const w = this.sim.weatherNow();
    const sch = this.sim.sch;
    const isBoss = c => !!c && (c.csuite || chars.some(o => o.position_parent && o.position_parent === c.position_id));
    return {
      r, day, min: m,
      here: here.map(x => x.c),
      byId: id => (id == null ? null : byId.get(id) || null),
      present: c => !!c && inOffice.has(c.id),
      where,
      inRoom: (c, place = null) => here.map(x => x.c).filter(o => o.id !== c.id && roomOf(where(o)) === roomOf(place || where(c))),
      traits: c => incidents.traits(c || {}),
      rel: (a, b) => (a && b ? this.rel(a, b) : { roce: 0, aprecio: 0 }),
      worstPair: () => {
        let best = null;
        for (const [k, v] of this.rels) {
          const [a, b] = k.split('>').map(Number);
          if (inOffice.has(a) && inOffice.has(b) && (!best || v.roce > best.roce)) best = { a: byId.get(a), b: byId.get(b), roce: v.roce };
        }
        return best;
      },
      boss: c => (c ? chars.find(o => c.position_parent && o.position_id === c.position_parent) || null : null),
      isBoss,
      mapTypes: this.sim.layout ? this.sim.layout.objectTypes : this.fallbackTypes,
      lunch: m >= sch.SCHEDULE.lunch - 15 && m <= sch.SCHEDULE.lunch + sch.SCHEDULE.lunchMin,
      cold: !!(w && w.temp <= 8), hot: !!(w && w.temp >= 28),
    };
  }

  // Cuándo toca el siguiente paso: si se pasa de la jornada, al día laborable siguiente por la mañana.
  schedule(day, m, after, r) {
    const sch = this.sim.sch;
    let next = m + tramas.between(r, after);
    if (next < sch.BLOCKS.tarde.to) return { day, min: next };
    return { day: nextWorkday(day), min: sch.BLOCKS.manana.from + 20 + ((next - sch.BLOCKS.tarde.to) % 90) };
  }

  async startPlot(spec, day, m, origin = 'sola') {
    const def = tramas.PLOTS[spec.kind];
    const ids = Object.fromEntries(Object.entries(spec.cast).map(([k, c]) => [k, c.id]));
    const P = { kind: spec.kind, ids, c: spec.cast, cast: spec.cast, state: spec.state || {} };
    const row = (await this.pool.query(
      `INSERT INTO office_plots (company_id, kind, title, cast_ids, state, step, next_day, next_min, origin, started_day)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $7) RETURNING *`,
      [this.companyId, spec.kind, def.title(P), ids, P.state, def.first, day, m, origin])).rows[0];
    this.plots.push(row);
    if (origin === 'sola') this.plotsToday = { day, n: (this.plotsToday && this.plotsToday.day === day ? this.plotsToday.n : 0) + 1 };
    return row;
  }

  async plotsTick(day, m, here) {
    if (!this.plotsToday || this.plotsToday.day !== day) {
      const n = (await this.pool.query(
        `SELECT COUNT(*)::int AS n FROM office_plots WHERE company_id = $1 AND started_day = $2 AND origin = 'sola'`, [this.companyId, day])).rows[0].n;
      this.plotsToday = { day, n };
    }
    const spec = tramas.maybeStart(this.plotCtx(day, m, here, 'nueva'), { active: this.plots, startedToday: this.plotsToday.n, minute: m });
    if (spec) await this.startPlot(spec, day, m, 'sola');
    for (const row of this.plots.slice()) {
      if (row.next_day > day || (row.next_day === day && row.next_min > m)) continue;
      await this.advancePlot(row, day, m, here);
    }
  }

  async advancePlot(row, day, m, here) {
    const x = this.plotCtx(day, m, here, `paso|${row.id}|${row.step}|${row.waits}`);
    const cast = Object.fromEntries(Object.entries(row.cast_ids).map(([k, id]) => [k, x.byId(id)]));
    const P = { id: row.id, kind: row.kind, step: row.step, ids: row.cast_ids, c: cast, cast, state: row.state, waits: row.waits };
    let b;
    try { b = tramas.runStep(P, x); } catch (e) { console.error('trama:', row.kind, row.step, e.message); b = { end: 'perdida' }; }
    if (b.wait) {
      if (row.waits + 1 >= tramas.MAX_WAITS) return this.endPlot(row, day, 'se_olvida');
      const nx = this.schedule(day, m, [30, 90], x.r);
      row.waits += 1; row.next_day = nx.day; row.next_min = nx.min;
      await this.pool.query('UPDATE office_plots SET waits = $2, next_day = $3, next_min = $4 WHERE id = $1', [row.id, row.waits, nx.day, nx.min]);
      return;
    }
    await this.applyBeat(row, b, day, m, x);
    if (b.cast) row.cast_ids = { ...row.cast_ids, ...Object.fromEntries(Object.entries(b.cast).map(([k, c]) => [k, c.id])) };
    if (b.state) row.state = { ...row.state, ...b.state };
    const def = tramas.PLOTS[row.kind];
    const title = def.title({ ...P, c: Object.fromEntries(Object.entries(row.cast_ids).map(([k, id]) => [k, x.byId(id)])), state: row.state });
    if (b.end || !b.next) {
      row.title = title;
      return this.endPlot(row, day, b.end || 'fin');
    }
    const nx = this.schedule(day, m, b.next[1], x.r);
    Object.assign(row, { step: b.next[0], waits: 0, next_day: nx.day, next_min: nx.min, title });
    await this.pool.query(
      'UPDATE office_plots SET step = $2, waits = 0, next_day = $3, next_min = $4, state = $5, cast_ids = $6, title = $7 WHERE id = $1',
      [row.id, row.step, nx.day, nx.min, row.state, row.cast_ids, title]);
  }

  async endPlot(row, day, outcome) {
    this.plots = this.plots.filter(p => p.id !== row.id);
    await this.pool.query('UPDATE office_plots SET ended_day = $2, outcome = $3, title = $4 WHERE id = $1', [row.id, day, outcome, row.title]);
  }

  // Lo que pasa en un paso: el feed, las escenas, las relaciones, el pentágono, incidentes y tramas nuevas.
  async applyBeat(row, b, day, m, x) {
    for (const s of b.scenes || []) {
      if (!s.c || !x.present(s.c)) continue;
      this.scenes.set(s.c.id, { day, until: m + (s.min || 10), lugar: s.lugar, que: s.que, frase: s.frase || '', con: s.con ? s.con.id : null });
    }
    const changed = tramas.applyRel(this.rels, b.rel);
    for (const [a, bb, v] of changed) {
      await this.pool.query(
        `INSERT INTO relations (company_id, a, b, roce, aprecio, day) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (company_id, a, b) DO UPDATE SET roce = $4, aprecio = $5`, [this.companyId, a, bb, v.roce, v.aprecio, day]);
    }
    for (const [c, delta] of b.stats || []) {
      if (c && x.present(c)) await this.sim.saveStats(c, stats.add(stats.normalize(c.stats), delta));
    }
    if (b.line) await this.sim.post(b.by || null, 'trama', b.line, day, { lugar: b.lugar || null, con: b.con ? b.con.id : null, min: m });
    if (b.incident) {
      const idef = incidents.BY_KIND[b.incident.kind];
      if (idef && !this.active.some(a => a.kind === idef.kind) && incidents.possible(idef, x.mapTypes)) {
        const dur = idef.duration ? m + idef.duration[0] : null;
        await this.start(idef, b.incident.cause || null, b.incident.victim || null, day, m, dur);
      }
    }
    if (b.spawn && b.spawn.cast && Object.values(b.spawn.cast).every(Boolean)
      && this.plots.length < tramas.MAX_ACTIVE + 1 && !this.plots.some(p => p.kind === b.spawn.kind && p.id !== row.id)) {
      const def = tramas.PLOTS[b.spawn.kind];
      const nx = this.schedule(day, m, [30, 120], x.r);
      await this.startPlot({ kind: b.spawn.kind, cast: b.spawn.cast, state: def.init ? def.init(x) : {} }, nx.day, nx.min, `trama:${row.kind}`);
    }
  }

  // ¿Está ahora en una escena de trama? → { lugar, que, frase, con } o null.
  sceneFor(c, m, day = this.lastDay) {
    const s = c && this.scenes.get(c.id);
    if (!s) return null;
    if (s.day !== day || m >= s.until) { this.scenes.delete(c.id); return null; }
    return { lugar: s.lugar, que: s.que, frase: s.frase, con: s.con };
  }

  // De qué se cotillea (chatter.js).
  plotGossip() {
    const x = { byId: id => (this.sim.chars || []).find(c => c.id === id) || null };
    return this.plots.filter(p => p.step !== tramas.PLOTS[p.kind].first || p.waits).map(p => {
      const def = tramas.PLOTS[p.kind];
      const cast = Object.fromEntries(Object.entries(p.cast_ids).map(([k, id]) => [k, x.byId(id)]));
      try { return { text: def.gossip({ c: cast, cast, state: p.state, ids: p.cast_ids }), ids: Object.values(p.cast_ids) }; } catch { return null; }
    }).filter(Boolean);
  }

  // Provocar una trama ya (modo pruebas). Devuelve la fila o un error en palabras.
  async forcePlot(kind, day, m) {
    const def = tramas.PLOTS[kind];
    if (!def) return { error: 'Esa trama no existe.' };
    if (this.plots.some(p => p.kind === kind)) return { error: 'Esa ya está en marcha.' };
    const here = this.here.length ? this.here : [];
    const x = this.plotCtx(day, m, here, `pruebas|${Date.now()}`);
    if (x.here.length < 2) return { error: 'Hace falta que haya al menos dos personas en la oficina.' };
    x.lunch = true;
    let cast = def.when(x);
    if (!cast) {
      const [a, b] = x.here.slice().sort(() => x.r() - 0.5);
      cast = Object.fromEntries(def.roles.map((role, i) => [role, i === 0 ? a : b]));
    }
    return this.startPlot({ kind, cast, state: def.init ? def.init(x) : {} }, day, m, 'pruebas');
  }

  // --- La mudanza (mudanza.js) ---

  get move() { return (this.sim.company.settings || {}).mudanza || null; }

  async saveSettings(patch) {
    const cur = (await this.pool.query('SELECT settings FROM companies WHERE id = $1', [this.companyId])).rows[0].settings;
    const next = { ...cur, ...patch };
    for (const [k, v] of Object.entries(patch)) if (v === null) delete next[k];
    await this.pool.query('UPDATE companies SET settings = $2 WHERE id = $1', [this.companyId, next]);
    this.sim.company.settings = next;
  }

  // Cada tick: empaquetar la tarde de antes, cambiar de oficina al salir de casa, los sucesos del
  // camino, la llegada y, pasado el día, borrar la mudanza.
  async moveTick(day, p) {
    const mv = this.move;
    if (!mv) return;
    const sch = this.sim.sch;
    if (!this.moveTo || this.moveTo.id !== mv.to) this.moveTo = await layouts.getFor(this.pool, this.companyId, mv.to);
    const to = this.moveTo;
    if (day > mv.day) { await this.saveSettings({ mudanza: null }); return; }
    if (day < mv.day) {
      if (nextWorkday(day) === mv.day && p.minutes >= sch.BLOCKS.tarde.from + 60 && !this.announced.has(`emp|${mv.day}`)) {
        this.announced.add(`emp|${mv.day}`);
        await this.sim.post(null, 'evento', `📦 Mañana nos mudamos a la nueva oficina (${to.name}). Toca empaquetar: cada uno con su caja.`, day, { min: p.minutes });
      }
      return;
    }
    // El día de la mudanza: al salir de casa, ya van a la nueva.
    if (p.minutes >= sch.COMMUTE.ida && this.sim.layout.id !== to.id) {
      await this.saveSettings({ oficina: to.id, mudanza: { ...mv, from: this.sim.layout.id } });
      this.sim.layout = to;
      this.sim.days.clear(); // las mesas y quién cabe se recalculan con la oficina nueva
    }
    for (const sx of mudanza.sucesosDe(day, this.companyId, sch.COMMUTE.ida, sch.BLOCKS.manana.from)) {
      if (p.minutes >= sx.min && !this.announced.has(`mud|${day}|${sx.min}`)) {
        this.announced.add(`mud|${day}|${sx.min}`);
        await this.sim.post(null, 'evento', sx.text, day, { min: sx.min });
      }
    }
    if (p.minutes >= sch.BLOCKS.manana.from && !this.announced.has(`lleg|${day}`)) {
      this.announced.add(`lleg|${day}`);
      await this.sim.post(null, 'evento', `🏢 ¡Primer día en la oficina nueva (${to.name})! Todo huele a nuevo y nadie encuentra el baño.`, day, { min: sch.BLOCKS.manana.from });
    }
  }

  // ¿Hoy es la mudanza y van de camino? → lo que lleva cada uno por la calle.
  moveCarga(c, day, phase) {
    const mv = this.move;
    return mv && mv.day === day && phase === 'ida' ? mudanza.cargaDe(c, day) : null;
  }

  // Cajas por la oficina: la tarde de antes (empaquetando) y la mañana de la mudanza (desempaquetando).
  boxes(day, m) {
    const mv = this.move;
    if (!mv) return false;
    const sch = this.sim.sch;
    if (mv.day === day) return m < sch.SCHEDULE.lunch;
    return nextWorkday(day) === mv.day && m >= sch.BLOCKS.tarde.from + 60;
  }

  // Para el prompt de la IA: el estado de la oficina que cualquiera notaría.
  promptLine(m) {
    const inc = this.active.map(i => String(i.data.title).split('.')[0]);
    const ev = this.events.filter(e => e.to_min > m).map(e => `${e.title} (${events.hhmm(e.from_min)})`);
    const out = this.outside.map(o => o.row.data.prompt);
    return [out.length ? `Fuera pasa algo gordo: ${out.join('; ')}.` : '',
      inc.length ? `En la oficina ahora: ${inc.join('; ')}.` : '', ev.length ? `Hoy hay: ${ev.join('; ')}.` : ''].filter(Boolean).join(' ');
  }

  // Lo que va al navegador para pintarlo.
  view(m, day = this.lastDay, phase = null) {
    const mv = this.move;
    return {
      cajas: this.boxes(day, m),
      mudanza: mv ? { to: mv.to, toName: (this.moveTo && this.moveTo.id === mv.to ? this.moveTo : layouts.get(mv.to)).name, day: mv.day, camion: mv.day === day && phase === 'ida' } : null,
      incidents: this.active.map(i => ({ id: i.id, kind: i.kind, place: i.place, title: i.data.title, sign: i.data.sign || null })),
      plots: this.plots.map(p => ({ id: p.id, kind: p.kind, icon: (tramas.PLOTS[p.kind] || {}).icon || '🎭', title: p.title })),
      outside: this.outside.map(({ row, def }) => ({
        id: row.id, kind: row.kind, icon: def.icon, sign: def.sign, title: row.data.title,
        place: (def.gather && def.gather.place) || null, from: events.hhmm(row.from_min), to: events.hhmm(row.to_min),
        active: m >= row.from_min && m < row.to_min,
      })),
      events: this.events.map(e => ({
        id: e.id, kind: e.kind, title: e.title, place: events.placeFor(e, this.sim.weatherNow()),
        from: events.hhmm(e.from_min), to: events.hhmm(e.to_min), active: m >= e.from_min && m < e.to_min,
      })),
    };
  }
}

module.exports = { OfficeLife, nextWorkday };
