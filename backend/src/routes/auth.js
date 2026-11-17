// Cuentas. El primer usuario es el admin (y el dueño: modo pruebas). Después del primero, se entra
// con una invitación (o con ALLOW_REGISTRATION=true).
// En el VPS, la puerta (gate.js) deja llegar aquí sin la contraseña común; entonces (req.gateOpen
// falso) crear cuenta exige invitación Y contraseña propia, y entrar exige la contraseña propia.
// Con la puerta pasada (o en local) se puede entrar solo con el correo, como hasta ahora.

const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('ERROR: JWT_SECRET falta o es corta (mínimo 32 caracteres).');
  process.exit(1);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const gate = require('../gate');
const MIN_PASSWORD = 8;
const passwordError = p => (p.length < MIN_PASSWORD ? `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`
  : p.length > 200 ? 'Esa contraseña es demasiado larga.' : null);

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
    const password = String(req.body.password || '');
    if (!EMAIL_RE.test(email) || !name) return res.status(400).json({ error: 'Pon tu nombre y un correo válido.' });
    const count = (await pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n;
    // Se entra con una invitación válida (o abierta por configuración, o si es el primero).
    const { validInvite, useInvite, addMember } = require('./companies');
    const inv = req.body.invite ? await validInvite(pool, req.body.invite) : null;
    if (req.gateOpen === false) {
      // Desde fuera de la puerta: solo con invitación, y con contraseña propia para poder volver.
      // code 'puerta': el frontend vuelve a enseñar la puerta (el dueño entra por ahí).
      if (!inv) return res.status(403).json({ error: 'Para entrar hace falta una invitación de alguien de dentro (o la contraseña de la oficina).', code: 'puerta' });
      const pe = passwordError(password);
      if (pe) return res.status(400).json({ error: pe });
    } else if (count > 0 && !inv && process.env.ALLOW_REGISTRATION !== 'true') {
      return res.status(403).json({ error: 'Para entrar hace falta una invitación de alguien de dentro.' });
    }
    if (password && passwordError(password)) return res.status(400).json({ error: passwordError(password) });
    try {
      const u = (await pool.query(
        `INSERT INTO users (email, name, is_admin, password_hash) VALUES ($1, $2, $3, $4)
         RETURNING id, email, name, is_admin, avatar_config`,
        [email, name, count === 0, password ? gate.hashPassword(password) : null])).rows[0];
      // El primero lleva la empresa de partida; quien viene invitado entra en la suya.
      if (count === 0) await addMember(pool, 1, u.id, 'admin');
      if (inv) await useInvite(pool, inv, u.id);
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
    const password = String(req.body.password || '');
    if (gate.tooMany(req.ip, 'login')) return res.status(429).json({ error: 'Demasiados intentos. Espera un cuarto de hora.' });
    const row = (await pool.query(
      'SELECT id, email, name, is_admin, avatar_config, password_hash, is_test FROM users WHERE email = $1', [email])).rows[0];
    const { password_hash: hash, is_test: isTest, ...u } = row || {};
    // Con contraseña propia, se comprueba siempre. Sin ella, solo se entra con la puerta pasada.
    // Los jugadores de prueba no entran por aquí (los maneja el dueño desde el modo pruebas).
    let ok = !!row && !isTest;
    if (ok && hash) ok = !!password && gate.verifyPassword(password, hash);
    else if (ok && req.gateOpen === false) ok = false;
    // Cuenta con contraseña propia y no la ha escrito (va plegada): que el formulario la pida, sin
    // contarlo como intento fallido.
    if (row && !isTest && hash && !password) return res.status(401).json({ error: 'Esta cuenta tiene contraseña: escríbela.', code: 'clave' });
    if (!ok) {
      gate.failed(req.ip, 'login');
      return res.status(401).json({ error: req.gateOpen === false || hash
        ? 'Correo o contraseña incorrectos.' : 'No hay nadie con ese correo.' });
    }
    gate.cleared(req.ip, 'login');
    res.json({ user: u, token: sign(u) });
  });

  // Ponerse (o cambiar) la contraseña propia, para entrar sin la contraseña común.
  r.put('/password', requireUser, async (req, res) => {
    const password = String(req.body.password || '');
    const pe = passwordError(password);
    if (pe) return res.status(400).json({ error: pe });
    await req.app.get('db').query('UPDATE users SET password_hash = $2 WHERE id = $1 AND NOT is_test', [req.userId, gate.hashPassword(password)]);
    res.json({ ok: true });
  });

  return r;
}

module.exports = { router, requireUser, verify };
