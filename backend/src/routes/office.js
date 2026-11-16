// Lo que ve cualquiera de la empresa (montado en /api/companies/:cid): el feed, los diarios, el
// historial, los ajustes de la oficina y el estado de un turno propio.

const express = require('express');
const weatherLib = require('../world/weather');
const { fromMinutes, toMinutes } = require('../world/clock');

// ¿Lo ve todo? Su dueño y quien lleva la empresa (admin; también en modo pruebas).
const fullView = (c, req) => c.owner_user_id === req.userId || req.role === 'admin';

// Cómo se le ve desde fuera, a partir de su pentágono (sin números).
function lookOf(stats) {
  const s = stats || {};
  const out = [];
  if (s.energia != null && s.energia < 1.8) out.push('se le ve cansado');
  if (s.saciedad != null && s.saciedad < 1.6) out.push('tiene cara de hambre');
  if (s.calma != null && s.calma < 1.8) out.push('anda agobiado');
  if (s.social != null && s.social < 1.5) out.push('lleva rato sin hablar con nadie');
  if (s.animo != null && s.animo > 4.2) out.push('está de muy buen humor');
  if (s.animo != null && s.animo < 1.8) out.push('está de bajón');
  return out.length ? out : ['tiene buena cara'];
}

function router({ world }) {
  const r = express.Router({ mergeParams: true });
  const adminOnly = (req, res, what) => {
    if (req.role === 'admin') return false;
    res.status(403).json({ error: `Solo quien lleva la empresa puede ${what}.` });
    return true;
  };

  r.get('/feed', async (req, res) => {
    const rows = (await req.app.get('db').query(
      'SELECT id, character_id, con_id, kind, text, lugar, min, office_day, created_at FROM feed WHERE company_id = $1 AND NOT private ORDER BY id DESC LIMIT 60', [req.companyId])).rows;
    res.json(rows.reverse());
  });

  r.get('/characters/:id', async (req, res) => {
    const pool = req.app.get('db');
    const c = (await pool.query(
      `SELECT id, name, owner_user_id, desk_index, ficha, humor, energia, cafe, stats FROM characters
        WHERE id = $1 AND company_id = $2 AND approved`, [req.params.id, req.companyId])).rows[0];
    if (!c) return res.status(404).json({ error: 'No existe.' });
    // Del tuyo (o si llevas la empresa) lo ves todo. De los demás, solo lo que se nota desde fuera:
    // cómo es y cómo se le ve, sin su objetivo secreto, su diario ni sus números.
    if (!fullView(c, req)) {
      const f = c.ficha || {};
      return res.json({
        id: c.id, name: c.name, humor: c.humor, full: false,
        ficha: { puesto: f.puesto, personalidad: f.personalidad, manias: f.manias || [], muletillas: f.muletillas || [] },
        aspecto: lookOf(c.stats), diaries: [],
      });
    }
    const diaries = (await pool.query(
      'SELECT day, text FROM diaries WHERE character_id = $1 ORDER BY day DESC LIMIT 7', [c.id])).rows;
    res.json({ ...c, full: true, aspecto: lookOf(c.stats), diaries });
  });

  // Historial de un personaje: lo que hizo y le dijeron, llamadas, trayectos, sueños, diarios y
  // (solo para su dueño, o el admin con los ficticios) lo que pensó. Paginado hacia atrás.
  r.get('/characters/:id/history', async (req, res) => {
    const pool = req.app.get('db');
    const id = Number(req.params.id);
    const c = (await pool.query('SELECT id, owner_user_id FROM characters WHERE id = $1 AND company_id = $2 AND approved', [id, req.companyId])).rows[0];
    if (!c) return res.status(404).json({ error: 'No existe.' });
    // Los pensamientos, los sueños y los diarios: los del suyo, y todos para quien lleva la empresa.
    const mine = fullView(c, req);
    const before = Number(req.query.before) || 2147483647;
    const rows = (await pool.query(
      `SELECT f.id, f.kind, f.text, f.office_day AS day, f.min, f.lugar, f.externo, f.private, f.created_at,
              f.character_id, f.con_id, a.name AS autor, o.name AS con
         FROM feed f
         LEFT JOIN characters a ON a.id = f.character_id
         LEFT JOIN characters o ON o.id = f.con_id
        WHERE (f.character_id = $1 OR f.con_id = $1) AND f.id < $2
          AND f.kind <> 'diario' AND ($3 OR NOT f.private)
        ORDER BY f.id DESC LIMIT 80`, [id, before, mine])).rows;
    const days = [...new Set(rows.map(r => r.day))];
    const diaries = days.length ? (await pool.query(
      'SELECT day, text FROM diaries WHERE character_id = $1 AND day = ANY($2)', [id, days])).rows : [];
    const dreams = mine && days.length ? (await pool.query(
      'SELECT morning AS day, text, followed, reason FROM dreams WHERE character_id = $1 AND morning = ANY($2)', [id, days])).rows : [];
    res.json({
      mine,
      items: rows.map(r => ({
        id: r.id,
        day: r.day,
        hhmm: r.min == null ? null : fromMinutes(r.min),
        kind: r.private ? 'pensamiento' : (r.character_id !== id ? 'le_dicen' : r.kind),
        text: r.text,
        lugar: r.lugar,
        con: r.con_id === id ? r.autor : r.con,
        externo: r.externo,
        at: r.created_at,
      })),
      diaries,
      dreams,
      next: rows.length === 80 ? rows[rows.length - 1].id : null,
    });
  });

  // Dónde está la oficina (para el tiempo). Verla, cualquiera; cambiarla, el admin.
  r.get('/settings/location', async (req, res) => {
    res.json({ location: req.sim.weather.location, weather: req.sim.weather.current });
  });

  // Horario de la oficina: entrada, salida, hora de comer y cuánto dura la comida.
  const hoursView = ({ SCHEDULE }) => ({
    start: fromMinutes(SCHEDULE.start), end: fromMinutes(SCHEDULE.end),
    lunch: fromMinutes(SCHEDULE.lunch), lunchMin: SCHEDULE.lunchMin,
  });

  r.get('/settings/hours', (req, res) => res.json(hoursView(req.sim.sch)));

  r.put('/settings/hours', async (req, res) => {
    if (adminOnly(req, res, 'cambiar el horario')) return;
    const b = req.body || {};
    const next = { start: toMinutes(b.start), end: toMinutes(b.end), lunch: toMinutes(b.lunch), lunchMin: Number.parseInt(b.lunchMin, 10) };
    const err = req.sim.sch.set(next);
    if (err) return res.status(400).json({ error: err });
    await req.app.get('db').query(
      `UPDATE companies SET settings = jsonb_set(settings, '{hours}', $2::jsonb) WHERE id = $1`,
      [req.companyId, JSON.stringify(req.sim.sch.SCHEDULE)]);
    await world.reload(req.companyId);
    res.json(hoursView(req.sim.sch));
  });

  r.put('/settings/location', async (req, res) => {
    if (adminOnly(req, res, 'mover la oficina')) return;
    const name = String(req.body.city || '').trim().slice(0, 80);
    if (!name) return res.status(400).json({ error: 'Dime una ciudad.' });
    let loc;
    try {
      loc = await weatherLib.geocode(name);
    } catch {
      return res.status(502).json({ error: 'No he podido buscar la ciudad ahora mismo. Prueba en un rato.' });
    }
    if (!loc) return res.status(404).json({ error: `No encuentro «${name}». Prueba con otra forma de escribirla.` });
    await req.sim.weather.setLocation(loc);
    res.json({ location: req.sim.weather.location, weather: req.sim.weather.current });
  });

  // Solo los turnos que paga quien pregunta.
  r.get('/turns/:id', async (req, res) => {
    const t = (await req.app.get('db').query(
      'SELECT id, kind, status, result, error FROM turns WHERE id = $1 AND payer_user_id = $2',
      [req.params.id, req.userId])).rows[0];
    if (!t) return res.status(404).json({ error: 'No existe.' });
    res.json(t);
  });

  return r;
}

module.exports = { router };
