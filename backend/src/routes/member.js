// Dentro de una empresa: /api/companies/:cid/… Solo para sus miembros. Lo de admin, solo para
// quien la lleva. Aquí se montan también las rutas de «mi personaje» (me.js) y de la oficina.

const crypto = require('crypto');
const express = require('express');
const { requireUser } = require('./auth');
const gm = require('../world/gameMaster');
const org = require('../company/org');
const { addMember } = require('./companies');
const me = require('./me');
const office = require('./office');
const pruebas = require('./pruebas');

const PLACES = ['mesa', 'despacho', 'recepcion'];
const WEEKDAYS = [1, 2, 3, 4, 5];

function router({ world }) {
  const r = express.Router({ mergeParams: true });
  r.use(requireUser);

  // ¿Es miembro? Deja a mano la empresa, el rol y su simulación.
  r.use(async (req, res, next) => {
    const cid = Number(req.params.cid);
    const m = (await req.app.get('db').query(
      'SELECT role FROM memberships WHERE company_id = $1 AND user_id = $2', [cid, req.userId])).rows[0];
    if (!m) return res.status(404).json({ error: 'No estás en esa empresa.', code: 'no_miembro' });
    req.companyId = cid;
    req.role = m.role;
    req.sim = await world.ensure(cid);
    next();
  });

  const admin = (req, res, next) => (req.role === 'admin' ? next()
    : res.status(403).json({ error: 'Esto solo lo puede hacer quien lleva la empresa.' }));

  // --- la empresa ---

  r.get('/', async (req, res) => {
    const c = (await req.app.get('db').query('SELECT id, name, visibility, settings, created_at FROM companies WHERE id = $1', [req.companyId])).rows[0];
    const s = c.settings || {};
    res.json({
      id: c.id, name: c.name, visibility: c.visibility, role: req.role,
      settings: {
        remotePerWeek: Number.isInteger(s.remotePerWeek) ? s.remotePerWeek : 2,
        officeDays: Array.isArray(s.officeDays) ? s.officeDays : [],
        jobBoard: s.jobBoard === true,
      },
    });
  });

  r.put('/', admin, async (req, res) => {
    const db = req.app.get('db');
    const b = req.body || {};
    const cur = (await db.query('SELECT name, visibility, settings FROM companies WHERE id = $1', [req.companyId])).rows[0];
    const name = b.name != null ? gm.clean(b.name, 60) : cur.name;
    if (!name) return res.status(400).json({ error: 'La empresa necesita nombre.' });
    const visibility = ['publica', 'privada'].includes(b.visibility) ? b.visibility : cur.visibility;
    const s = { ...cur.settings };
    const set = b.settings || {};
    if (set.remotePerWeek != null) {
      const n = Number.parseInt(set.remotePerWeek, 10);
      if (!(n >= 0 && n <= 5)) return res.status(400).json({ error: 'Días de teletrabajo por semana: de 0 a 5.' });
      s.remotePerWeek = n;
    }
    if (set.officeDays != null) {
      if (!Array.isArray(set.officeDays) || !set.officeDays.every(d => WEEKDAYS.includes(d))) {
        return res.status(400).json({ error: 'Días de oficina: de lunes (1) a viernes (5).' });
      }
      s.officeDays = [...new Set(set.officeDays)].sort();
    }
    if (set.jobBoard != null) s.jobBoard = set.jobBoard === true;
    await db.query('UPDATE companies SET name = $2, visibility = $3, settings = $4 WHERE id = $1', [req.companyId, name, visibility, s]);
    if (s.jobBoard) await queueAds(req, db);
    await world.reload(req.companyId);
    res.json({ ok: true });
  });

  // Al abrir el tablón, la IA escribe UNA vez la oferta de broma de cada vacante (paga el admin).
  async function queueAds(req, db) {
    const { vacancies } = require('./companies');
    const prompts = require('../ai/prompts');
    const turns = require('../ai/turns');
    const { parts } = require('../world/clock');
    const day = parts(req.sim.clock.nowMs()).date;
    const company = (await db.query('SELECT name FROM companies WHERE id = $1', [req.companyId])).rows[0].name;
    for (const v of await vacancies(db, req.companyId)) {
      if (v.ad) continue;
      const pending = (await db.query(
        `SELECT 1 FROM turns WHERE kind = 'anuncio' AND status IN ('queued', 'running') AND request->>'positionId' = $1`, [String(v.id)])).rows[0];
      if (pending) continue;
      const request = prompts.adRequest({ company, title: v.title });
      request.positionId = v.id;
      await turns.enqueue(db, { kind: 'anuncio', characterId: null, payerUserId: req.userId, day, model: 'haiku', request });
    }
  }

  // --- organigrama ---

  r.get('/org', async (req, res) => {
    const db = req.app.get('db');
    const positions = (await db.query(
      'SELECT id, parent_id, title, csuite, is_unique, seats, place, sort FROM positions WHERE company_id = $1 ORDER BY sort, id',
      [req.companyId])).rows;
    const holders = (await db.query(
      `SELECT c.id, c.name, c.position_id, c.owner_user_id, c.approved, c.npc_seat, c.sin_ia,
              COALESCE(u.avatar_config, c.avatar_config) AS avatar_config
         FROM characters c LEFT JOIN users u ON u.id = c.owner_user_id
        WHERE c.company_id = $1 AND c.position_id IS NOT NULL AND NOT c.retired AND NOT c.paused`, [req.companyId])).rows;
    res.json({
      positions: positions.map(p => ({
        ...p,
        holders: holders.filter(h => h.position_id === p.id).map(h => ({
          character_id: h.id, name: h.name, human: h.owner_user_id != null, mine: h.owner_user_id === req.userId,
          ai: !h.sin_ia && (h.owner_user_id != null || p.csuite), avatar_config: h.avatar_config,
        })),
      })),
    });
  });

  function readPosition(b, cur = {}) {
    const title = b.title != null ? gm.clean(b.title, 60) : cur.title;
    if (!title) return { error: 'El cargo necesita nombre.' };
    const seats = b.seats != null ? Number.parseInt(b.seats, 10) : (cur.seats ?? 1);
    if (!(seats >= 0 && seats <= 10)) return { error: 'Plazas para ficticios: de 0 a 10.' };
    const place = b.place != null ? b.place : (cur.place || 'mesa');
    if (!PLACES.includes(place)) return { error: 'Sitio: mesa, despacho o recepción.' };
    return {
      title, seats, place,
      csuite: b.csuite != null ? b.csuite === true : !!cur.csuite,
      is_unique: b.is_unique != null ? b.is_unique === true : (cur.is_unique ?? true),
      parent_id: b.parent_id !== undefined ? (b.parent_id == null ? null : Number(b.parent_id)) : cur.parent_id ?? null,
    };
  }

  async function parentOk(db, companyId, parentId, selfId = null) {
    if (parentId == null) return true;
    if (parentId === selfId) return false;
    // Sin ciclos: subir desde el padre propuesto no puede pasar por el propio cargo.
    let cur = parentId;
    for (let i = 0; i < 50 && cur != null; i++) {
      const p = (await db.query('SELECT parent_id FROM positions WHERE id = $1 AND company_id = $2', [cur, companyId])).rows[0];
      if (!p) return false;
      if (selfId != null && p.parent_id === selfId) return false;
      cur = p.parent_id;
    }
    return true;
  }

  r.post('/org/positions', admin, async (req, res) => {
    const db = req.app.get('db');
    const p = readPosition(req.body || {});
    if (p.error) return res.status(400).json({ error: p.error });
    if (!(await parentOk(db, req.companyId, p.parent_id))) return res.status(400).json({ error: 'Ese cargo de arriba no existe.' });
    const row = (await db.query(
      `INSERT INTO positions (company_id, parent_id, title, csuite, is_unique, seats, place, sort)
       VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT COALESCE(MAX(sort), 0) + 1 FROM positions WHERE company_id = $1)) RETURNING *`,
      [req.companyId, p.parent_id, p.title, p.csuite, p.is_unique, p.seats, p.place])).rows[0];
    await org.rebalance(db, row.id);
    req.sim.invalidate();
    res.status(201).json(row);
  });

  r.put('/org/positions/:id', admin, async (req, res) => {
    const db = req.app.get('db');
    const cur = (await db.query('SELECT * FROM positions WHERE id = $1 AND company_id = $2', [req.params.id, req.companyId])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Ese cargo no existe.' });
    const p = readPosition(req.body || {}, cur);
    if (p.error) return res.status(400).json({ error: p.error });
    if (!(await parentOk(db, req.companyId, p.parent_id, cur.id))) return res.status(400).json({ error: 'Así quedaría un cargo por encima de sí mismo.' });
    if (p.is_unique && !cur.is_unique) {
      const humans = (await db.query('SELECT COUNT(*)::int AS n FROM characters WHERE position_id = $1 AND owner_user_id IS NOT NULL', [cur.id])).rows[0].n;
      if (humans > 1) return res.status(409).json({ error: 'Ahí ya hay varias personas: no puede pasar a ser único.' });
    }
    const row = (await db.query(
      `UPDATE positions SET parent_id = $3, title = $4, csuite = $5, is_unique = $6, seats = $7, place = $8, ad = NULL
        WHERE id = $1 AND company_id = $2 RETURNING *`,
      [cur.id, req.companyId, p.parent_id, p.title, p.csuite, p.is_unique, p.seats, p.place])).rows[0];
    await org.rebalance(db, row.id);
    req.sim.invalidate();
    res.json(row);
  });

  // Borrar un cargo: solo si no hay personas; sus subordinados suben un nivel y sus ficticios se van.
  r.delete('/org/positions/:id', admin, async (req, res) => {
    const db = req.app.get('db');
    const cur = (await db.query('SELECT * FROM positions WHERE id = $1 AND company_id = $2', [req.params.id, req.companyId])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Ese cargo no existe.' });
    const humans = (await db.query('SELECT COUNT(*)::int AS n FROM characters WHERE position_id = $1 AND owner_user_id IS NOT NULL', [cur.id])).rows[0].n;
    if (humans) return res.status(409).json({ error: 'Hay personas en ese cargo: que se cambien antes.' });
    await db.query('UPDATE positions SET parent_id = $2 WHERE parent_id = $1', [cur.id, cur.parent_id]);
    await db.query('UPDATE characters SET retired = TRUE WHERE position_id = $1 AND npc_seat', [cur.id]);
    await db.query('DELETE FROM positions WHERE id = $1', [cur.id]);
    req.sim.invalidate();
    res.json({ ok: true });
  });

  // --- pedirle un cargo único a quien lo tiene ---

  const myCharacter = async (db, req) => (await db.query(
    'SELECT * FROM characters WHERE company_id = $1 AND owner_user_id = $2', [req.companyId, req.userId])).rows[0];

  r.get('/org/requests', async (req, res) => {
    const db = req.app.get('db');
    const c = await myCharacter(db, req);
    if (!c) return res.json({ incoming: [], outgoing: [] });
    const q = col => db.query(
      `SELECT r.id, r.status, r.created_at, p.title AS position, a.name AS from_name, b.name AS to_name
         FROM position_requests r JOIN positions p ON p.id = r.position_id
         JOIN characters a ON a.id = r.from_character JOIN characters b ON b.id = r.to_character
        WHERE r.${col} = $1 AND r.status = 'pendiente' ORDER BY r.id DESC`, [c.id]);
    res.json({ incoming: (await q('to_character')).rows, outgoing: (await q('from_character')).rows });
  });

  r.post('/org/requests', async (req, res) => {
    const db = req.app.get('db');
    const c = await myCharacter(db, req);
    if (!c || !c.approved) return res.status(400).json({ error: 'Primero ten personaje aprobado en esta empresa.' });
    if (!c.position_id) return res.status(400).json({ error: 'Primero elige un cargo libre: si te dan este, os lo intercambiáis.' });
    const positionId = Number(req.body.position_id);
    const holder = await org.humanHolder(db, positionId, c.id);
    if (!holder) return res.status(400).json({ error: 'Ese cargo no lo tiene nadie de verdad: cógelo directamente.' });
    try {
      const row = (await db.query(
        `INSERT INTO position_requests (from_character, to_character, position_id) VALUES ($1, $2, $3) RETURNING id, status`,
        [c.id, holder.id, positionId])).rows[0];
      res.status(201).json(row);
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Ya se lo has pedido; espera respuesta.' });
      throw e;
    }
  });

  r.post('/org/requests/:id', async (req, res) => {
    const db = req.app.get('db');
    const c = await myCharacter(db, req);
    const rq = c && (await db.query(
      `SELECT * FROM position_requests WHERE id = $1 AND to_character = $2 AND status = 'pendiente'`, [req.params.id, c.id])).rows[0];
    if (!rq) return res.status(404).json({ error: 'No hay ninguna petición así para ti.' });
    if (req.body.accept === true) {
      const from = (await db.query('SELECT * FROM characters WHERE id = $1', [rq.from_character])).rows[0];
      // Si ya no tiene ese cargo (o el otro ya cambió), la petición queda anulada.
      if (c.position_id !== rq.position_id || !from || !from.position_id) {
        await db.query(`UPDATE position_requests SET status = 'anulada', decided_at = NOW() WHERE id = $1`, [rq.id]);
        return res.status(409).json({ error: 'Las cosas han cambiado desde la petición: queda anulada.' });
      }
      await org.swap(db, from, c);
      await db.query(`UPDATE position_requests SET status = 'aceptada', decided_at = NOW() WHERE id = $1`, [rq.id]);
      await db.query(`UPDATE position_requests SET status = 'anulada', decided_at = NOW()
                       WHERE status = 'pendiente' AND position_id = $1`, [rq.position_id]);
      req.sim.invalidate();
      return res.json({ status: 'aceptada' });
    }
    await db.query(`UPDATE position_requests SET status = 'rechazada', decided_at = NOW() WHERE id = $1`, [rq.id]);
    res.json({ status: 'rechazada' });
  });

  // --- carga de trabajo (la marca el admin) ---

  r.get('/workload', async (req, res) => {
    const rows = (await req.app.get('db').query(
      `SELECT day, level, note FROM workload WHERE company_id = $1 AND day >= CURRENT_DATE - 7 ORDER BY day LIMIT 120`,
      [req.companyId])).rows;
    res.json(rows);
  });

  r.put('/workload/:day', admin, async (req, res) => {
    const day = String(req.params.day);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ error: 'Día con formato AAAA-MM-DD.' });
    const level = Number.parseInt(req.body.level, 10);
    if (!(level >= 0 && level <= 3)) return res.status(400).json({ error: 'Carga: 0 tranquila, 1 normal, 2 alta, 3 a tope.' });
    const note = gm.clean(req.body.note, 140) || null;
    await req.app.get('db').query(
      `INSERT INTO workload (company_id, day, level, note) VALUES ($1, $2, $3, $4)
       ON CONFLICT (company_id, day) DO UPDATE SET level = EXCLUDED.level, note = EXCLUDED.note`, [req.companyId, day, level, note]);
    res.json({ day, level, note });
  });

  r.delete('/workload/:day', admin, async (req, res) => {
    await req.app.get('db').query('DELETE FROM workload WHERE company_id = $1 AND day = $2', [req.companyId, String(req.params.day)]);
    res.json({ ok: true });
  });

  // --- invitaciones y peticiones de entrada (admin) ---

  r.get('/invitations', admin, async (req, res) => {
    const rows = (await req.app.get('db').query(
      `SELECT id, code, expires_at, max_uses, uses, revoked FROM invitations WHERE company_id = $1 ORDER BY id DESC LIMIT 50`,
      [req.companyId])).rows;
    res.json(rows);
  });

  r.post('/invitations', admin, async (req, res) => {
    const days = Math.min(30, Math.max(1, Number.parseInt(req.body.days, 10) || 7));
    const maxUses = Math.min(100, Math.max(1, Number.parseInt(req.body.max_uses, 10) || 10));
    const code = crypto.randomBytes(12).toString('base64url');
    const row = (await req.app.get('db').query(
      `INSERT INTO invitations (company_id, code, created_by, expires_at, max_uses)
       VALUES ($1, $2, $3, NOW() + ($4 || ' days')::interval, $5) RETURNING id, code, expires_at, max_uses, uses, revoked`,
      [req.companyId, code, req.userId, String(days), maxUses])).rows[0];
    res.status(201).json(row);
  });

  r.delete('/invitations/:id', admin, async (req, res) => {
    await req.app.get('db').query('UPDATE invitations SET revoked = TRUE WHERE id = $1 AND company_id = $2', [req.params.id, req.companyId]);
    res.json({ ok: true });
  });

  r.get('/join-requests', admin, async (req, res) => {
    const rows = (await req.app.get('db').query(
      `SELECT j.id, j.message, j.created_at, u.name, p.title AS position
         FROM join_requests j JOIN users u ON u.id = j.user_id LEFT JOIN positions p ON p.id = j.position_id
        WHERE j.company_id = $1 AND j.status = 'pendiente' ORDER BY j.id`, [req.companyId])).rows;
    res.json(rows);
  });

  r.post('/join-requests/:id', admin, async (req, res) => {
    const db = req.app.get('db');
    const j = (await db.query(`SELECT * FROM join_requests WHERE id = $1 AND company_id = $2 AND status = 'pendiente'`,
      [req.params.id, req.companyId])).rows[0];
    if (!j) return res.status(404).json({ error: 'Esa petición ya no está pendiente.' });
    const accept = req.body.accept === true;
    await db.query(`UPDATE join_requests SET status = $2, decided_at = NOW() WHERE id = $1`, [j.id, accept ? 'aceptada' : 'rechazada']);
    if (accept) await addMember(db, req.companyId, j.user_id);
    res.json({ status: accept ? 'aceptada' : 'rechazada', position_id: j.position_id });
  });

  // Eventos de la oficina (events.js). Los ve cualquiera; los crea y borra el admin. Un automático
  // borrado se marca como cancelado para que no vuelva a salir.
  const EV = require('../world/events');
  const { parts: clockParts } = require('../world/clock');
  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
  const toMin = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  r.get('/eventos', async (req, res) => {
    const day = clockParts(req.sim.clock.nowMs()).date;
    const rows = (await req.app.get('db').query(
      `SELECT id, kind, title, place, day::text, from_min, to_min, auto FROM office_events
        WHERE company_id = $1 AND day >= $2 AND NOT cancelled ORDER BY day, from_min LIMIT 60`, [req.companyId, day])).rows;
    res.json({ kinds: Object.entries(EV.KINDS).map(([k, v]) => ({ kind: k, label: v.label, icon: v.icon })), places: EV.PLACES,
      events: rows.map(e => ({ ...e, from: EV.hhmm(e.from_min), to: EV.hhmm(e.to_min) })) });
  });
  r.post('/eventos', admin, async (req, res) => {
    const b = req.body || {};
    const kind = EV.KINDS[b.kind] ? b.kind : 'otro';
    const title = gm.clean(b.title || '', 80);
    if (!title) return res.status(400).json({ error: 'Ponle un nombre al evento.' });
    if (!EV.PLACES.includes(b.place)) return res.status(400).json({ error: 'Elige dónde: terraza, zona chill, sala de reuniones o cocina.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.day || '')) return res.status(400).json({ error: 'Elige el día.' });
    if (!HHMM.test(b.from || '') || !HHMM.test(b.to || '') || toMin(b.to) <= toMin(b.from)) {
      return res.status(400).json({ error: 'La hora de fin tiene que ir después de la de inicio.' });
    }
    const row = (await req.app.get('db').query(
      `INSERT INTO office_events (company_id, kind, title, place, day, from_min, to_min, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (company_id, day, kind, from_min) DO UPDATE SET title = EXCLUDED.title, place = EXCLUDED.place,
         to_min = EXCLUDED.to_min, cancelled = FALSE RETURNING id`,
      [req.companyId, kind, title, b.place, b.day, toMin(b.from), toMin(b.to), req.userId])).rows[0];
    req.sim.life.invalidateEvents();
    res.status(201).json(row);
  });
  r.delete('/eventos/:id', admin, async (req, res) => {
    await req.app.get('db').query('UPDATE office_events SET cancelled = TRUE WHERE id = $1 AND company_id = $2', [req.params.id, req.companyId]);
    req.sim.life.invalidateEvents();
    res.json({ ok: true });
  });

  r.use('/pruebas', pruebas.router({ world }));
  r.use('/me', me.router());
  r.use('/', office.router({ world }));
  return r;
}

module.exports = { router };
