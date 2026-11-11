// Entrada solo con correo (de momento, para uso local). El primer usuario es el admin.
// Después del primero, el registro solo queda abierto si ALLOW_REGISTRATION=true.
// ⚠️ No exponer a Internet así: falta el enlace mágico por correo (doc/oficina-viva.md).

const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('ERROR: JWT_SECRET falta o es corta (mínimo 32 caracteres).');
  process.exit(1);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sign(user) {
  return jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
}

function verify(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function requireUser(req, res, next) {
  const h = req.headers.authorization || '';
  const payload = verify(h.startsWith('Bearer ') ? h.slice(7) : '');
  if (!payload) return res.status(401).json({ error: 'Tienes que entrar otra vez.' });
  req.userId = payload.userId;
  next();
}

function router({ onUsersChanged }) {
  const r = express.Router();

  r.post('/register', async (req, res) => {
    const pool = req.app.get('db');
    const email = String(req.body.email || '').trim().toLowerCase();
    const name = String(req.body.name || '').trim().slice(0, 40);
    if (!EMAIL_RE.test(email) || !name) return res.status(400).json({ error: 'Pon tu nombre y un correo válido.' });
    const count = (await pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n;
    if (count > 0 && process.env.ALLOW_REGISTRATION !== 'true') {
      return res.status(403).json({ error: 'La oficina está completa. Pide invitación a quien la lleva.' });
    }
    try {
      const u = (await pool.query(
        'INSERT INTO users (email, name, is_admin) VALUES ($1, $2, $3) RETURNING id, email, name, is_admin, avatar_config',
        [email, name, count === 0])).rows[0];
      onUsersChanged();
      res.status(201).json({ user: u, token: sign(u) });
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Ese correo ya tiene cuenta: entra con él.' });
      throw e;
    }
  });

  r.post('/login', async (req, res) => {
    const pool = req.app.get('db');
    const email = String(req.body.email || '').trim().toLowerCase();
    const u = (await pool.query('SELECT id, email, name, is_admin, avatar_config FROM users WHERE email = $1', [email])).rows[0];
    if (!u) return res.status(404).json({ error: 'No hay nadie con ese correo.' });
    res.json({ user: u, token: sign(u) });
  });

  return r;
}

module.exports = { router, requireUser, verify };
