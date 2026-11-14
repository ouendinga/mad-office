// Lo que ve cualquiera que esté dentro: el feed, los diarios y el estado de un turno propio.

const express = require('express');
const { requireUser } = require('./auth');
const weatherLib = require('../world/weather');
const { fromMinutes, toMinutes, SCHEDULE, setSchedule } = require('../world/clock');

function router({ weather } = {}) {
  const r = express.Router();
  r.use(requireUser);

  r.get('/feed', async (req, res) => {
    const rows = (await req.app.get('db').query(
      'SELECT id, character_id, kind, text, created_at FROM feed WHERE NOT private ORDER BY id DESC LIMIT 60')).rows;
    res.json(rows.reverse());
  });

  r.get('/characters/:id', async (req, res) => {
    const pool = req.app.get('db');
    const c = (await pool.query(
      `SELECT id, name, owner_user_id, desk_index, ficha, humor, energia, cafe, stats FROM characters
        WHERE id = $1 AND approved`, [req.params.id])).rows[0];
    if (!c) return res.status(404).json({ error: 'No existe.' });
    const diaries = (await pool.query(
      'SELECT day, text FROM diaries WHERE character_id = $1 ORDER BY day DESC LIMIT 7', [c.id])).rows;
    res.json({ ...c, diaries });
  });

  // Historial de un personaje: lo que hizo y le dijeron, llamadas, trayectos, sueños, diarios y
  // (solo para su dueño, o el admin con los ficticios) lo que pensó. Paginado hacia atrás.
  r.get('/characters/:id/history', async (req, res) => {
    const pool = req.app.get('db');
    const id = Number(req.params.id);
    const c = (await pool.query('SELECT id, owner_user_id FROM characters WHERE id = $1 AND approved', [id])).rows[0];
    if (!c) return res.status(404).json({ error: 'No existe.' });
    const viewer = (await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.userId])).rows[0] || {};
    const mine = c.owner_user_id === req.userId || (c.owner_user_id == null && viewer.is_admin);
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
    res.json({ location: weather ? weather.location : weatherLib.DEFAULT_LOCATION, weather: weather ? weather.current : null });
  });

  // Horario de la oficina: entrada, salida, hora de comer y cuánto dura la comida.
  const hoursView = () => ({
    start: fromMinutes(SCHEDULE.start), end: fromMinutes(SCHEDULE.end),
    lunch: fromMinutes(SCHEDULE.lunch), lunchMin: SCHEDULE.lunchMin,
  });

  r.get('/settings/hours', (req, res) => res.json(hoursView()));

  r.put('/settings/hours', async (req, res) => {
    const pool = req.app.get('db');
    const u = (await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.userId])).rows[0];
    if (!u || !u.is_admin) return res.status(403).json({ error: 'Solo quien lleva la oficina puede cambiar el horario.' });
    const b = req.body || {};
    const next = { start: toMinutes(b.start), end: toMinutes(b.end), lunch: toMinutes(b.lunch), lunchMin: Number.parseInt(b.lunchMin, 10) };
    const err = setSchedule(next);
    if (err) return res.status(400).json({ error: err });
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('office_hours', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [JSON.stringify(SCHEDULE)]);
    res.json(hoursView());
  });

  r.put('/settings/location', async (req, res) => {
    const pool = req.app.get('db');
    const u = (await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.userId])).rows[0];
    if (!u || !u.is_admin) return res.status(403).json({ error: 'Solo quien lleva la oficina puede moverla.' });
    const name = String(req.body.city || '').trim().slice(0, 80);
    if (!name) return res.status(400).json({ error: 'Dime una ciudad.' });
    let loc;
    try {
      loc = await weatherLib.geocode(name);
    } catch {
      return res.status(502).json({ error: 'No he podido buscar la ciudad ahora mismo. Prueba en un rato.' });
    }
    if (!loc) return res.status(404).json({ error: `No encuentro «${name}». Prueba con otra forma de escribirla.` });
    await weather.setLocation(loc);
    res.json({ location: weather.location, weather: weather.current });
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
