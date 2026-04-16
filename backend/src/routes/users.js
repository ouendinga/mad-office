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

// Get all users with mood states
router.get('/', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.name, u.desk_index, u.avatar_config, u.position_x, u.position_y,
             m.alegria, m.energia, m.optimismo, m.frustracion, m.estres,
             m.current_action, m.current_representation, m.action_started_at
      FROM users u
      LEFT JOIN mood_states m ON u.id = m.user_id
      ORDER BY u.desk_index NULLS LAST
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error obteniendo usuarios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Update avatar config
router.put('/:id/avatar', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { avatar_config } = req.body;
  const pool = req.app.get('db');
  const io = req.app.get('io');

  try {
    const result = await pool.query(
      'UPDATE users SET avatar_config = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name, desk_index, avatar_config',
      [JSON.stringify(avatar_config), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    io.emit('avatar:updated', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error actualizando avatar:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Update user profile
router.put('/:id/profile', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  const pool = req.app.get('db');

  try {
    const result = await pool.query(
      'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), updated_at = NOW() WHERE id = $3 RETURNING id, email, name, desk_index, avatar_config',
      [name, email, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error actualizando perfil:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
