// Todo lo de MI personaje EN ESTA EMPRESA (montado en /api/companies/:cid/me): entrevista,
// ficha, cargo, sueño y gasto. El avatar es de la persona (va en /api/me/avatar).

const express = require('express');
const gm = require('../world/gameMaster');
const prompts = require('../ai/prompts');
const turns = require('../ai/turns');
const { parts, dreamWindowOpen, nextMorning } = require('../world/clock');
const { nextDesk, join, rebalance } = require('../company/org');

const MAX_PROFILE_ATTEMPTS = 3;
const MAX_DREAM_HELP = 3;

function router() {
  const r = express.Router({ mergeParams: true });

  const today = req => parts(req.sim.clock.nowMs());

  async function me(pool, userId, companyId) {
    const u = (await pool.query('SELECT id, email, name, is_admin, avatar_config FROM users WHERE id = $1', [userId])).rows[0];
    const c = (await pool.query('SELECT * FROM characters WHERE owner_user_id = $1 AND company_id = $2', [userId, companyId])).rows[0] || null;
    return { u, c };
  }

  r.get('/', async (req, res) => {
    const { u, c } = await me(req.app.get('db'), req.userId, req.companyId);
    if (!u) return res.status(401).json({ error: 'Tienes que entrar otra vez.' });
    res.json({ user: u, character: c });
  });

  // Entrevista → turno de IA que genera la ficha. Se consulta con GET /api/turns/:id.
  r.post('/interview', async (req, res) => {
    const pool = req.app.get('db');
    const { u, c: existing } = await me(pool, req.userId, req.companyId);
    const answers = {};
    for (const [q, a] of Object.entries(req.body.answers || {}).slice(0, 10)) {
      const k = gm.clean(q, 80);
      const v = gm.clean(a, 400); // el campo libre admite más
      if (k && v) answers[k] = v;
    }
    if (Object.keys(answers).length < 3) return res.status(400).json({ error: 'Contesta al menos 3 preguntas.' });
    const p = today(req);
    let c = existing;
    if (!c) {
      const desk = await nextDesk(pool, req.companyId);
      c = (await pool.query(
        'INSERT INTO characters (company_id, owner_user_id, name, desk_index) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.companyId, u.id, u.name, desk])).rows[0];
      // Si eligió cargo antes de la entrevista, se coloca ya.
      if (Number.isInteger(req.body.position_id)) await join(pool, c, req.body.position_id);
    }
    const attempts = c.profile_attempts_day === p.date ? c.profile_attempts : 0;
    if (attempts >= MAX_PROFILE_ATTEMPTS) {
      return res.status(429).json({ error: 'Por hoy ya vale de rehacer la ficha: retócala a mano o vuelve mañana.' });
    }
    await pool.query('UPDATE characters SET interview = $2, profile_attempts = $3, profile_attempts_day = $4 WHERE id = $1',
      [c.id, answers, attempts + 1, p.date]);
    const t = await turns.enqueue(pool, {
      kind: 'perfil', characterId: c.id, payerUserId: u.id, day: p.date, model: c.model,
      request: prompts.profileRequest({ name: u.name, answers }),
    });
    if (t.skipped) return res.status(429).json({ error: t.skipped === 'tope' ? 'Has gastado el tope de IA de hoy.' : 'Ya está en marcha.' });
    res.status(202).json({ turnId: t.id, attemptsLeft: MAX_PROFILE_ATTEMPTS - attempts - 1 });
  });

  // Retoque a mano y aprobación. Sin aprobar, el personaje no sale a la oficina.
  r.put('/ficha', async (req, res) => {
    const pool = req.app.get('db');
    const { c } = await me(pool, req.userId, req.companyId);
    if (!c) return res.status(404).json({ error: 'Aún no tienes personaje.' });
    let ficha;
    try {
      ficha = gm.validateFichaEdit(req.body.ficha || {});
    } catch {
      return res.status(400).json({ error: 'Faltan cosas: puesto, personalidad, objetivo y al menos 3 muletillas.' });
    }
    const approve = req.body.approve === true;
    const row = (await pool.query(
      'UPDATE characters SET ficha = $2, approved = approved OR $3 WHERE id = $1 RETURNING *', [c.id, ficha, approve])).rows[0];
    // Al aprobarse, la persona ocupa de verdad su cargo: el ficticio de ese hueco se retira.
    if (row.position_id) await rebalance(pool, row.position_id);
    req.sim.invalidate();
    // La primera vez: ¡contratado! Se anuncia en la oficina y el frontend enseña la escena.
    let hired = null;
    if (approve && !c.approved) {
      const pos = row.position_id ? (await pool.query('SELECT title FROM positions WHERE id = $1', [row.position_id])).rows[0] : null;
      const comp = (await pool.query('SELECT name FROM companies WHERE id = $1', [req.companyId])).rows[0];
      hired = { company: comp.name, position: pos ? pos.title : row.ficha.puesto };
      await req.sim.post(row, 'sistema', `📰 ${row.name} se incorpora a ${comp.name} como ${hired.position}. ¡Que alguien le enseñe dónde está el café!`, today(req).date);
    }
    res.json({ ...row, hired });
  });

  r.put('/settings', async (req, res) => {
    const pool = req.app.get('db');
    const { c } = await me(pool, req.userId, req.companyId);
    if (!c) return res.status(404).json({ error: 'Aún no tienes personaje.' });
    const model = ['haiku', 'sonnet'].includes(req.body.model) ? req.body.model : c.model;
    const paused = typeof req.body.paused === 'boolean' ? req.body.paused : c.paused;
    const row = (await pool.query('UPDATE characters SET model = $2, paused = $3 WHERE id = $1 RETURNING *', [c.id, model, paused])).rows[0];
    if (row.position_id) await rebalance(pool, row.position_id); // en pausa, vuelve el ficticio
    req.sim.invalidate();
    res.json(row);
  });

  // Cargo en el organigrama. Si es único y lo tiene otra persona, devuelve 409 con quién lo tiene
  // (entonces se le puede pedir con POST /org/requests).
  r.post('/position', async (req, res) => {
    const pool = req.app.get('db');
    const { u } = await me(pool, req.userId, req.companyId);
    let { c } = await me(pool, req.userId, req.companyId);
    // Se puede elegir cargo antes de la entrevista: el personaje nace aquí (sin aprobar).
    if (!c) {
      c = (await pool.query(
        'INSERT INTO characters (company_id, owner_user_id, name, desk_index) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.companyId, u.id, u.name, await nextDesk(pool, req.companyId)])).rows[0];
    }
    const out = await join(pool, c, Number(req.body.position_id));
    if (out.error) return res.status(out.code === 'ocupado' ? 409 : 400).json({ error: out.error, code: out.code, holder: out.holder });
    req.sim.invalidate();
    res.json(out.position);
  });

  // --- Sueño ---

  r.get('/dream', async (req, res) => {
    const pool = req.app.get('db');
    const { c } = await me(pool, req.userId, req.companyId);
    if (!c) return res.status(404).json({ error: 'Aún no tienes personaje.' });
    const p = today(req);
    const morning = nextMorning(p, req.sim.sch);
    const tonight = (await pool.query('SELECT text FROM dreams WHERE character_id = $1 AND morning = $2', [c.id, morning])).rows[0];
    const last = (await pool.query(
      `SELECT morning, text, followed, reason FROM dreams WHERE character_id = $1 AND followed IS NOT NULL
        ORDER BY morning DESC LIMIT 1`, [c.id])).rows[0];
    res.json({ open: dreamWindowOpen(p, req.sim.sch), morning, text: tonight ? tonight.text : '', last: last || null });
  });

  r.put('/dream', async (req, res) => {
    const pool = req.app.get('db');
    const { c } = await me(pool, req.userId, req.companyId);
    if (!c) return res.status(404).json({ error: 'Aún no tienes personaje.' });
    const p = today(req);
    if (!dreamWindowOpen(p, req.sim.sch)) return res.status(409).json({ error: 'Ahora está despierto. Los sueños, de 18:00 a 09:00.' });
    const text = gm.clean(req.body.text, 200);
    if (!text) return res.status(400).json({ error: 'El sueño está vacío.' });
    const morning = nextMorning(p, req.sim.sch);
    await pool.query(
      `INSERT INTO dreams (character_id, morning, text) VALUES ($1, $2, $3)
       ON CONFLICT (character_id, morning) DO UPDATE SET text = EXCLUDED.text, updated_at = NOW()`, [c.id, morning, text]);
    res.json({ morning, text });
  });

  r.post('/dream/help', async (req, res) => {
    const pool = req.app.get('db');
    const { u, c } = await me(pool, req.userId, req.companyId);
    if (!c || !c.approved) return res.status(404).json({ error: 'Aún no tienes personaje.' });
    const p = today(req);
    const used = (await pool.query(
      `SELECT COUNT(*)::int AS n FROM turns WHERE character_id = $1 AND kind = 'sueno_ayuda' AND office_day = $2`,
      [c.id, p.date])).rows[0].n;
    if (used >= MAX_DREAM_HELP) return res.status(429).json({ error: 'La musa se ha ido a dormir. Escríbelo tú, que sabes.' });
    const diary = (await pool.query('SELECT text FROM diaries WHERE character_id = $1 ORDER BY day DESC LIMIT 1', [c.id])).rows[0];
    const cast = await req.sim.loadCharacters();
    const t = await turns.enqueue(pool, {
      kind: 'sueno_ayuda', characterId: c.id, payerUserId: u.id, day: p.date, model: c.model,
      request: prompts.dreamHelpRequest({ character: c, cast, diary: diary && diary.text, draft: gm.clean(req.body.draft, 200) }),
    });
    if (t.skipped) return res.status(429).json({ error: 'Has gastado el tope de IA de hoy.' });
    res.status(202).json({ turnId: t.id });
  });

  r.get('/usage', async (req, res) => {
    const p = today(req);
    const s = await turns.spentToday(req.app.get('db'), req.userId, p.date);
    res.json({ day: p.date, ...s, cap: turns.DAILY_CAP_USD });
  });

  return r;
}

module.exports = { router };
