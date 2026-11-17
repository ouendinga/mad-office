// Modo pruebas (/api/companies/:cid/pruebas): solo para el dueño (users.is_admin, el primero que
// se registró) en una empresa que lleva él. Sirve para probar sin esperar a que sea laborable:
//   - mover el reloj de ESA empresa (ir a una hora, adelantar, acelerar, volver a la hora real);
//   - crear jugadores de prueba (cuentas inventadas, con o sin IA) y entrar como ellos.
// Lo de las demás empresas no se toca: cada una lleva su propio reloj.

const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const clockLib = require('../world/clock');
const gm = require('../world/gameMaster');
const org = require('../company/org');
const { NPCS, SPARE_NAMES, avatar } = require('../company/template');
const { addMember } = require('./companies');
const incidentsLib = require('../world/incidents');
const tramasLib = require('../world/tramas');
const eventsLib = require('../world/events');
const outsideLib = require('../world/outside');

const SPEEDS = [1, 2, 5, 10, 30, 60];
const PLOT_LABEL = {
  guerra_postits: 'La guerra de los pósits', taper_misterioso: 'El táper desaparecido', apuesta_pingpong: 'La apuesta del ping-pong',
  rumor: 'El rumor', termostato: 'La guerra del termostato', cumple_sorpresa: 'La tarta sorpresa',
  excursion_bar: 'La expedición al bar', nota_micro: 'La nota del micro',
};
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_TEST_PLAYERS = 12;

function router({ world }) {
  const r = express.Router({ mergeParams: true });
  const db = req => req.app.get('db');

  r.use(async (req, res, next) => {
    const u = (await db(req).query('SELECT is_admin FROM users WHERE id = $1', [req.userId])).rows[0];
    if (!u || !u.is_admin || req.role !== 'admin') {
      return res.status(403).json({ error: 'El modo pruebas es solo para el dueño de la oficina.' });
    }
    next();
  });

  const state = async req => {
    const c = (await db(req).query('SELECT settings FROM companies WHERE id = $1', [req.companyId])).rows[0];
    const players = (await db(req).query(
      `SELECT u.id, u.name, ch.id AS character_id, ch.sin_ia, p.title AS position
         FROM users u JOIN memberships m ON m.user_id = u.id AND m.company_id = $1
         LEFT JOIN characters ch ON ch.owner_user_id = u.id AND ch.company_id = $1
         LEFT JOIN positions p ON p.id = ch.position_id
        WHERE u.is_test ORDER BY u.id`, [req.companyId])).rows;
    const p = clockLib.parts(req.sim.clock.nowMs());
    const reloj = c.settings.reloj || null;
    return { active: !c.settings.pruebas_apagado, now: { date: p.date, hhmm: p.hhmm, weekday: p.weekday }, moved: !!reloj, speed: reloj ? reloj.speed : 1, players };
  };

  r.get('/', async (req, res) => res.json(await state(req)));

  // Interruptor del modo pruebas. Apagado: la oficina vuelve a la hora real y los jugadores de
  // prueba se pausan (no salen en la oficina, pero no se borran). Encendido: vuelven.
  const setActive = async (req, on) => {
    const pool = db(req);
    const cur = (await pool.query('SELECT settings FROM companies WHERE id = $1', [req.companyId])).rows[0].settings;
    if (on) delete cur.pruebas_apagado;
    else { cur.pruebas_apagado = true; delete cur.reloj; }
    await pool.query('UPDATE companies SET settings = $2 WHERE id = $1', [req.companyId, cur]);
    await pool.query(
      `UPDATE characters SET paused = $2 WHERE company_id = $1 AND owner_user_id IN (SELECT id FROM users WHERE is_test)`,
      [req.companyId, !on]);
    await world.reload(req.companyId);
    req.sim.invalidate();
  };
  r.put('/modo', async (req, res) => {
    await setActive(req, req.body && req.body.on === true);
    res.json(await state(req));
  });

  // Reloj: { reset } | { hhmm, day: 'hoy'|'laborable', speed } | { plus: minutos } | { speed }.
  r.put('/reloj', async (req, res) => {
    const b = req.body || {};
    if (!b.reset) await setActive(req, true);
    const base = req.sim.baseClock;
    const now = req.sim.clock.nowMs();
    const cur = (await db(req).query('SELECT settings FROM companies WHERE id = $1', [req.companyId])).rows[0].settings;
    let speed = b.speed != null ? Number(b.speed) : (cur.reloj ? cur.reloj.speed : 1);
    if (!SPEEDS.includes(speed)) return res.status(400).json({ error: `Velocidad: ${SPEEDS.join(', ')}.` });
    let officeAt = now;
    if (b.reset) {
      delete cur.reloj;
    } else {
      if (b.hhmm != null) {
        if (!HHMM.test(b.hhmm)) return res.status(400).json({ error: 'La hora va como 09:30.' });
        let date = clockLib.parts(now).date;
        // «laborable»: hoy si lo es, si no el siguiente lunes a viernes.
        if (b.day === 'laborable') {
          while (!clockLib.isWorkday(clockLib.parts(clockLib.madridMs(date, '12:00')).weekday)) date = clockLib.addDays(date, 1);
        }
        officeAt = clockLib.madridMs(date, b.hhmm);
      } else if (b.plus != null) {
        const plus = Number(b.plus);
        if (!(plus > 0 && plus <= 24 * 60)) return res.status(400).json({ error: 'Adelanta entre 1 minuto y 24 horas.' });
        officeAt = now + plus * 60000;
      }
      cur.reloj = { realAt: base.nowMs(), officeAt, speed };
    }
    await db(req).query('UPDATE companies SET settings = $2 WHERE id = $1', [req.companyId, cur]);
    await world.reload(req.companyId);
    res.json(await state(req));
  });

  // Jugador de prueba: una cuenta inventada con su personaje ya aprobado, en el cargo que se diga
  // (o en uno de plazas). Por defecto sin IA (piloto automático, gratis).
  r.post('/jugadores', async (req, res) => {
    const pool = db(req);
    await setActive(req, true);
    const b = req.body || {};
    const n = (await pool.query(
      `SELECT COUNT(*)::int AS n FROM users u JOIN memberships m ON m.user_id = u.id AND m.company_id = $1 WHERE u.is_test`,
      [req.companyId])).rows[0].n;
    if (n >= MAX_TEST_PLAYERS) return res.status(400).json({ error: `Como mucho ${MAX_TEST_PLAYERS} jugadores de prueba por empresa.` });
    const name = gm.clean(b.name || '', 40) || SPARE_NAMES[(n * 5 + req.companyId) % SPARE_NAMES.length];
    let positionId = Number(b.position_id) || null;
    if (!positionId) {
      const free = (await pool.query(
        'SELECT id FROM positions WHERE company_id = $1 AND NOT is_unique ORDER BY random() LIMIT 1', [req.companyId])).rows[0];
      if (!free) return res.status(400).json({ error: 'No hay cargos de varias plazas: elige uno.' });
      positionId = free.id;
    }
    const pos = (await pool.query('SELECT title FROM positions WHERE id = $1 AND company_id = $2', [positionId, req.companyId])).rows[0];
    if (!pos) return res.status(400).json({ error: 'Ese cargo no existe en esta empresa.' });

    // Ficha: la de un ficticio cualquiera del catálogo, con el puesto de su cargo.
    const all = Object.values(NPCS).flat();
    const [, , ficha] = all[Math.floor(Math.random() * all.length)];
    const rnd = k => Math.floor(Math.random() * k);
    const av = avatar([rnd(4), rnd(8), rnd(6), rnd(6), rnd(4)]);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const u = (await client.query(
        `INSERT INTO users (email, name, is_test, avatar_config) VALUES ($1, $2, TRUE, $3) RETURNING id, name`,
        [`prueba-${crypto.randomBytes(5).toString('hex')}@pruebas.invalid`, name, av])).rows[0];
      await addMember(client, req.companyId, u.id);
      const ch = (await client.query(
        `INSERT INTO characters (company_id, owner_user_id, name, desk_index, approved, ficha, sin_ia)
         VALUES ($1, $2, $3, $4, TRUE, $5, $6) RETURNING *`,
        [req.companyId, u.id, name, await org.nextDesk(client, req.companyId), { ...ficha, puesto: pos.title }, b.ia !== true])).rows[0];
      const out = await org.join(client, ch, positionId);
      if (out.error) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: out.error });
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    req.sim.invalidate();
    res.status(201).json(await state(req));
  });

  // Provocar un incidente o un evento ahora mismo (para verlo sin esperar a que toque).
  r.get('/catalogo', (req, res) => res.json({
    incidents: incidentsLib.CATALOG.map(d => ({ kind: d.kind, place: d.place, example: d.title({ name: 'Alguien' }, { name: 'Otro' }) })),
    events: Object.entries(eventsLib.KINDS).map(([k, v]) => ({ kind: k, label: `${v.icon} ${v.label}` })),
    outside: outsideLib.CATALOG.map(d => ({ kind: d.kind, label: `${d.icon} ${d.sign.charAt(0)}${d.sign.slice(1).toLowerCase()}` })),
    plots: Object.entries(tramasLib.PLOTS).map(([k, d]) => ({ kind: k, label: `${d.icon} ${PLOT_LABEL[k] || k}` })),
  }));
  // Empezar ya una trama (con gente que esté ahora en la oficina).
  r.post('/trama', async (req, res) => {
    const p = clockLib.parts(req.sim.clock.nowMs());
    const row = await req.sim.life.forcePlot(req.body && req.body.kind, p.date, p.minutes);
    if (row.error) return res.status(409).json({ error: row.error });
    res.status(201).json({ ok: true, title: row.title });
  });
  // Provocar hoy un suceso de fuera (la nevada, la final…): su franja empieza ya.
  r.post('/fuera', async (req, res) => {
    const def = outsideLib.BY_KIND[req.body && req.body.kind];
    if (!def) return res.status(400).json({ error: 'Ese suceso no existe.' });
    const life = req.sim.life;
    const p = clockLib.parts(req.sim.clock.nowMs());
    if (life.outsideDay !== p.date) await life.loadOutside(p.date);
    if (life.outside.some(o => o.def.kind === def.kind)) return res.status(409).json({ error: 'Ese ya está pasando hoy.' });
    const row = await life.startOutside(def, p.date, p.minutes, { forced: true });
    if (!row) return res.status(409).json({ error: 'Ese ya ha pasado hoy.' });
    res.status(201).json({ ok: true });
  });
  r.post('/incidente', async (req, res) => {
    const def = incidentsLib.BY_KIND[req.body && req.body.kind];
    if (!def) return res.status(400).json({ error: 'Ese incidente no existe.' });
    const life = req.sim.life;
    if (life.active.some(a => a.kind === def.kind)) return res.status(409).json({ error: 'Ese ya está pasando.' });
    const p = clockLib.parts(req.sim.clock.nowMs());
    const chars = await req.sim.loadCharacters();
    const cause = def.cause || def.small ? chars[Math.floor(Math.random() * chars.length)] || null : null;
    const victim = def.victim ? chars.find(c => !cause || c.id !== cause.id) || null : null;
    const ends = def.duration ? p.minutes + def.duration[0] : null;
    await life.start(def, cause, victim, p.date, p.minutes, ends);
    res.status(201).json({ ok: true });
  });
  r.post('/evento', async (req, res) => {
    const kind = eventsLib.KINDS[req.body && req.body.kind] ? req.body.kind : 'afterwork';
    const p = clockLib.parts(req.sim.clock.nowMs());
    const k = eventsLib.KINDS[kind];
    await db(req).query(
      `INSERT INTO office_events (company_id, kind, title, place, day, from_min, to_min, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
      [req.companyId, kind, `${k.label} de prueba`, kind === 'taller' || kind === 'charla' ? 'reuniones' : kind === 'cumple' ? 'cafe' : 'terraza',
        p.date, p.minutes, p.minutes + 40, req.userId]);
    req.sim.life.invalidateEvents();
    res.status(201).json({ ok: true });
  });

  // Mudarse ya (para verla): la mudanza para el próximo laborable y el reloj a la salida de casa de
  // ese día. Con el modo pruebas activo.
  r.post('/mudanza', async (req, res) => {
    const layouts = require('../world/layout');
    const to = req.body && req.body.to;
    const exists = layouts.ids().includes(to) || (layouts.isCustom(to)
      && (await db(req).query('SELECT 1 FROM office_plans WHERE id = $1 AND company_id = $2', [Number(to.slice(1)), req.companyId])).rows.length);
    if (!exists || to === req.sim.layout.id) return res.status(400).json({ error: 'Elige otra oficina.' });
    await setActive(req, true);
    const now = req.sim.clock.nowMs();
    let date = clockLib.addDays(clockLib.parts(now).date, 1);
    while (!clockLib.isWorkday(clockLib.parts(clockLib.madridMs(date, '12:00')).weekday)) date = clockLib.addDays(date, 1);
    const cur = (await db(req).query('SELECT settings FROM companies WHERE id = $1', [req.companyId])).rows[0].settings;
    const ida = req.sim.sch.COMMUTE.ida;
    cur.mudanza = { to, day: date };
    cur.reloj = { realAt: req.sim.baseClock.nowMs(), officeAt: clockLib.madridMs(date, clockLib.fromMinutes(ida + 2)), speed: 5 };
    await db(req).query('UPDATE companies SET settings = $2 WHERE id = $1', [req.companyId, cur]);
    await world.reload(req.companyId);
    res.json(await state(req));
  });

  // Encender o apagar la IA de un jugador de prueba.
  r.put('/jugadores/:uid', async (req, res) => {
    await db(req).query(
      `UPDATE characters SET sin_ia = $3 WHERE owner_user_id = $1 AND company_id = $2
          AND owner_user_id IN (SELECT id FROM users WHERE is_test)`, [req.params.uid, req.companyId, req.body.ia !== true]);
    req.sim.invalidate();
    res.json(await state(req));
  });

  r.delete('/jugadores/:uid', async (req, res) => {
    const pool = db(req);
    const u = (await pool.query(
      `SELECT u.id, ch.position_id FROM users u JOIN memberships m ON m.user_id = u.id AND m.company_id = $2
         LEFT JOIN characters ch ON ch.owner_user_id = u.id AND ch.company_id = $2
        WHERE u.id = $1 AND u.is_test`, [req.params.uid, req.companyId])).rows[0];
    if (!u) return res.status(404).json({ error: 'Ese jugador de prueba no existe.' });
    await pool.query('DELETE FROM users WHERE id = $1', [u.id]);
    if (u.position_id) await org.rebalance(pool, u.position_id);
    req.sim.invalidate();
    res.json(await state(req));
  });

  // Entrar como un jugador de prueba (para ver y jugar con su cuenta). El frontend guarda la
  // sesión del dueño para volver.
  r.post('/jugadores/:uid/entrar', async (req, res) => {
    const u = (await db(req).query(
      `SELECT u.id, u.email, u.name, u.is_admin, u.avatar_config FROM users u
         JOIN memberships m ON m.user_id = u.id AND m.company_id = $2 WHERE u.id = $1 AND u.is_test`,
      [req.params.uid, req.companyId])).rows[0];
    if (!u) return res.status(404).json({ error: 'Ese jugador de prueba no existe.' });
    res.json({ user: u, token: jwt.sign({ userId: u.id }, process.env.JWT_SECRET, { expiresIn: '1d' }) });
  });

  return r;
}

module.exports = { router };
