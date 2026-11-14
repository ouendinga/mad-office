// La puerta: contraseña común de los paneles *.alvarosolis.dev delante de TODA la web.
// Solo se activa con GATE=on (en el VPS). Guarda solo el hash (scrypt) y limita intentos.
// La contraseña la pone Álvaro con ~/projects/bin/clave-paneles (→ `node src/cli.js clave`).

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ENABLED = process.env.GATE === 'on';
const COOKIE = 'mo_gate';
const MAX_AGE_S = 30 * 24 * 3600;
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [alg, saltHex, hashHex] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const got = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, got);
}

function readCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function cookieOk(header) {
  if (!ENABLED) return true;
  const token = readCookie(header, COOKIE);
  if (!token) return false;
  try {
    return jwt.verify(token, process.env.JWT_SECRET).gate === true;
  } catch {
    return false;
  }
}

async function storedHash(pool) {
  const r = await pool.query("SELECT value FROM settings WHERE key = 'gate_hash'");
  return r.rows[0] ? r.rows[0].value : null;
}

async function setPassword(pool, password) {
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ('gate_hash', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [hashPassword(password)]);
}

// Rutas que no pasan por la puerta: salud, la propia puerta y el despertador (tiene su token).
const OPEN = [/^\/api\/health$/, /^\/api\/gate$/, /^\/api\/runner\//];

function middleware(req, res, next) {
  // originalUrl: montado en /api, req.path ya no lleva el prefijo.
  const path = req.originalUrl.split('?')[0];
  if (!ENABLED || OPEN.some(re => re.test(path)) || cookieOk(req.headers.cookie)) return next();
  res.status(401).json({ error: 'Hace falta la contraseña de la oficina.', code: 'gate' });
}

const fails = new Map(); // ip -> [timestamps]

function router(express) {
  const r = express.Router();

  r.get('/', async (req, res) => {
    res.json({
      required: ENABLED,
      open: cookieOk(req.headers.cookie),
      configured: ENABLED ? !!(await storedHash(req.app.get('db'))) : true,
    });
  });

  r.post('/', async (req, res) => {
    if (!ENABLED) return res.json({ open: true });
    const ip = req.ip;
    const now = Date.now();
    const recent = (fails.get(ip) || []).filter(t => now - t < WINDOW_MS);
    if (recent.length >= MAX_FAILS) {
      return res.status(429).json({ error: 'Demasiados intentos. Espera un cuarto de hora.' });
    }
    const stored = await storedHash(req.app.get('db'));
    if (!stored) return res.status(503).json({ error: 'Aún no hay contraseña puesta (clave-paneles).' });
    if (!verifyPassword(String(req.body.password || ''), stored)) {
      recent.push(now);
      fails.set(ip, recent);
      return res.status(401).json({ error: 'Esa no es.' });
    }
    fails.delete(ip);
    const token = jwt.sign({ gate: true }, process.env.JWT_SECRET, { expiresIn: MAX_AGE_S });
    const secure = process.env.GATE_INSECURE_COOKIE === 'true' ? '' : '; Secure';
    res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Max-Age=${MAX_AGE_S}; Path=/; HttpOnly; SameSite=Lax${secure}`);
    res.json({ open: true });
  });

  return r;
}

module.exports = { ENABLED, hashPassword, verifyPassword, readCookie, cookieOk, setPassword, middleware, router };
