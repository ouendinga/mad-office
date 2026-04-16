const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalido' });
  }
}

// Get mood state for a user
router.get('/:userId', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const result = await pool.query(
      'SELECT * FROM mood_states WHERE user_id = $1',
      [req.params.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estado de animo no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error obteniendo estado de animo:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get recent events for a user
router.get('/:userId/events', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const result = await pool.query(
      'SELECT * FROM mock_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error obteniendo eventos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
