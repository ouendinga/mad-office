const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'REDACTED_JWT_SECRET';

// Register
router.post('/register', async (req, res) => {
  const { email, name } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: 'Email y nombre son requeridos' });
  }

  const pool = req.app.get('db');

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'El usuario ya existe' });
    }

    // Assign next available desk (dynamic - no limit)
    const deskResult = await pool.query(
      'SELECT COALESCE(MAX(desk_index), -1) + 1 AS next_desk FROM users'
    );
    const deskIndex = deskResult.rows[0].next_desk;

    const result = await pool.query(
      'INSERT INTO users (email, name, desk_index) VALUES ($1, $2, $3) RETURNING id, email, name, desk_index, avatar_config',
      [email, name, deskIndex]
    );

    const user = result.rows[0];

    // Create initial mood state
    await pool.query(
      'INSERT INTO mood_states (user_id) VALUES ($1)',
      [user.id]
    );

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email es requerido' });
  }

  const pool = req.app.get('db');

  try {
    const result = await pool.query(
      'SELECT id, email, name, desk_index, avatar_config FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ user, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
