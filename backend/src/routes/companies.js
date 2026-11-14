// Cuenta y empresas (fuera de una empresa concreta):
//   GET  /api/me                      la persona y sus empresas
//   PUT  /api/me/avatar               su avatar (el mismo en todas sus empresas)
//   POST /api/companies               crear una empresa (quien la crea es su admin)
//   GET  /api/public/companies        empresas públicas
//   GET  /api/jobs                    tablón «Se busca personal» (vacantes de empresas públicas)
//   POST /api/companies/:cid/join     pedir entrar a una empresa pública (opcional: a un cargo)
//   GET  /api/invitations/:code       a qué empresa invita un enlace
//   POST /api/invitations/:code       aceptar la invitación

const express = require('express');
const { requireUser } = require('./auth');
const gm = require('../world/gameMaster');

const VISIBILITY = ['publica', 'privada'];

async function validInvite(db, code) {
  const r = await db.query(
    `SELECT i.*, c.name AS company_name FROM invitations i JOIN companies c ON c.id = i.company_id
      WHERE i.code = $1 AND NOT i.revoked AND i.expires_at > NOW() AND i.uses < i.max_uses`, [String(code || '')]);
  return r.rows[0] || null;
}

// Entra en la empresa (si no estaba). Devuelve true si es nuevo.
async function addMember(db, companyId, userId, role = 'miembro') {
  const r = await db.query(
    `INSERT INTO memberships (company_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING user_id`,
    [companyId, userId, role]);
  return r.rows.length > 0;
}

async function useInvite(db, inv, userId) {
  const fresh = await addMember(db, inv.company_id, userId);
  if (fresh) await db.query('UPDATE invitations SET uses = uses + 1 WHERE id = $1', [inv.id]);
  return fresh;
}

// Vacantes: cargos sin ninguna persona de verdad (los ocupa un ficticio o nadie).
async function vacancies(db, companyId) {
  const r = await db.query(
    `SELECT p.id, p.title, p.csuite, p.is_unique, p.ad,
            (SELECT COUNT(*) FROM characters c WHERE c.position_id = p.id AND c.owner_user_id IS NOT NULL AND c.approved)::int AS humans
       FROM positions p WHERE p.company_id = $1 ORDER BY p.sort, p.id`, [companyId]);
  return r.rows.filter(p => !(p.is_unique && p.humans > 0));
}

function router({ world }) {
  const r = express.Router();
  r.use(requireUser);

  r.get('/me', async (req, res) => {
    const db = req.app.get('db');
    const u = (await db.query('SELECT id, email, name, is_admin, avatar_config FROM users WHERE id = $1', [req.userId])).rows[0];
    if (!u) return res.status(401).json({ error: 'Tienes que entrar otra vez.' });
    const companies = (await db.query(
      `SELECT c.id, c.name, c.visibility, m.role,
              ch.id AS character_id, ch.approved, ch.position_id, p.title AS position_title
         FROM memberships m JOIN companies c ON c.id = m.company_id
         LEFT JOIN characters ch ON ch.company_id = c.id AND ch.owner_user_id = m.user_id
         LEFT JOIN positions p ON p.id = ch.position_id
        WHERE m.user_id = $1 ORDER BY m.joined_at`, [req.userId])).rows;
    res.json({ user: u, companies });
  });

  r.put('/me/avatar', async (req, res) => {
    const db = req.app.get('db');
    const cfg = req.body.avatar_config || {};
    const n = (v, max) => Math.max(0, Math.min(max, Number.parseInt(v, 10) || 0));
    const clean = {
      skinTone: n(cfg.skinTone, 3), hairStyle: n(cfg.hairStyle, 7), hairColor: n(cfg.hairColor, 5),
      clothes: n(cfg.clothes, 5), accessory: n(cfg.accessory, 3),
    };
    const u = (await db.query('UPDATE users SET avatar_config = $2 WHERE id = $1 RETURNING id, email, name, is_admin, avatar_config',
      [req.userId, clean])).rows[0];
    for (const sim of world.sims.values()) sim.invalidate();
    res.json(u);
  });

  r.post('/companies', async (req, res) => {
    const db = req.app.get('db');
    const name = gm.clean(req.body.name, 60);
    if (!name) return res.status(400).json({ error: 'Ponle nombre a la empresa.' });
    const visibility = VISIBILITY.includes(req.body.visibility) ? req.body.visibility : 'privada';
    const own = (await db.query(`SELECT COUNT(*)::int AS n FROM memberships WHERE user_id = $1 AND role = 'admin'`, [req.userId])).rows[0].n;
    if (own >= 10) return res.status(429).json({ error: 'Ya llevas 10 empresas. ¿No son suficientes?' });
    const c = (await db.query(
      `INSERT INTO companies (name, visibility, settings, created_by) VALUES ($1, $2, '{"remotePerWeek":2,"jobBoard":false}', $3)
       RETURNING id, name, visibility`, [name, visibility, req.userId])).rows[0];
    await addMember(db, c.id, req.userId, 'admin');
    await world.ensure(c.id); // siembra el organigrama y arranca su oficina
    res.status(201).json({ ...c, role: 'admin' });
  });

  r.get('/public/companies', async (req, res) => {
    const rows = (await req.app.get('db').query(
      `SELECT c.id, c.name, (c.settings->>'jobBoard')::boolean AS job_board,
              (SELECT COUNT(*) FROM memberships m WHERE m.company_id = c.id)::int AS members,
              EXISTS (SELECT 1 FROM memberships m WHERE m.company_id = c.id AND m.user_id = $1) AS mine,
              EXISTS (SELECT 1 FROM join_requests j WHERE j.company_id = c.id AND j.user_id = $1 AND j.status = 'pendiente') AS pending
         FROM companies c WHERE c.visibility = 'publica' ORDER BY members DESC, c.id LIMIT 100`, [req.userId])).rows;
    res.json(rows);
  });

  // «Se busca personal»: solo empresas públicas con el tablón activado por su admin.
  r.get('/jobs', async (req, res) => {
    const db = req.app.get('db');
    const companies = (await db.query(
      `SELECT id, name FROM companies WHERE visibility = 'publica' AND (settings->>'jobBoard')::boolean ORDER BY id LIMIT 50`)).rows;
    const out = [];
    for (const c of companies) {
      for (const v of await vacancies(db, c.id)) {
        out.push({
          company: { id: c.id, name: c.name },
          position: { id: v.id, title: v.title, csuite: v.csuite },
          ad: v.ad || { titulo: `Se busca: ${v.title}`, texto: 'Oferta en redacción. Se valorará saber dónde está la cafetera.', requisitos: [] },
        });
      }
    }
    res.json(out);
  });

  r.post('/companies/:cid/join', async (req, res) => {
    const db = req.app.get('db');
    const cid = Number(req.params.cid);
    const c = (await db.query(`SELECT id, visibility FROM companies WHERE id = $1`, [cid])).rows[0];
    if (!c || c.visibility !== 'publica') return res.status(404).json({ error: 'Esa empresa no existe o solo se entra por invitación.' });
    const already = (await db.query('SELECT 1 FROM memberships WHERE company_id = $1 AND user_id = $2', [cid, req.userId])).rows[0];
    if (already) return res.status(409).json({ error: 'Ya estás dentro.' });
    let positionId = Number.isInteger(req.body.position_id) ? req.body.position_id : null;
    if (positionId && !(await db.query('SELECT 1 FROM positions WHERE id = $1 AND company_id = $2', [positionId, cid])).rows[0]) positionId = null;
    try {
      const j = (await db.query(
        `INSERT INTO join_requests (company_id, user_id, position_id, message) VALUES ($1, $2, $3, $4) RETURNING id, status`,
        [cid, req.userId, positionId, gm.clean(req.body.message, 280) || null])).rows[0];
      res.status(201).json(j);
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Ya tienes una petición pendiente aquí.' });
      throw e;
    }
  });

  r.get('/invitations/:code', async (req, res) => {
    const inv = await validInvite(req.app.get('db'), req.params.code);
    if (!inv) return res.status(404).json({ error: 'Esta invitación no vale (caducada, usada o anulada). Pide otra.' });
    res.json({ company: { id: inv.company_id, name: inv.company_name } });
  });

  r.post('/invitations/:code', async (req, res) => {
    const db = req.app.get('db');
    const inv = await validInvite(db, req.params.code);
    if (!inv) return res.status(404).json({ error: 'Esta invitación no vale (caducada, usada o anulada). Pide otra.' });
    await useInvite(db, inv, req.userId);
    res.json({ company: { id: inv.company_id, name: inv.company_name } });
  });

  return r;
}

module.exports = { router, validInvite, useInvite, addMember, vacancies };
