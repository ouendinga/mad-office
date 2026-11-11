// Lo que ve cualquiera que esté dentro: el feed, los diarios y el estado de un turno propio.

const express = require('express');
const { requireUser } = require('./auth');

function router() {
  const r = express.Router();
  r.use(requireUser);

  r.get('/feed', async (req, res) => {
    const rows = (await req.app.get('db').query(
      'SELECT id, character_id, kind, text, created_at FROM feed ORDER BY id DESC LIMIT 60')).rows;
    res.json(rows.reverse());
  });

  r.get('/characters/:id', async (req, res) => {
    const pool = req.app.get('db');
    const c = (await pool.query(
      `SELECT id, name, owner_user_id, desk_index, ficha, humor, energia, cafe FROM characters
        WHERE id = $1 AND approved`, [req.params.id])).rows[0];
    if (!c) return res.status(404).json({ error: 'No existe.' });
    const diaries = (await pool.query(
      'SELECT day, text FROM diaries WHERE character_id = $1 ORDER BY day DESC LIMIT 7', [c.id])).rows;
    res.json({ ...c, diaries });
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
