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

// Huella de la contraseña vigente: va dentro de la cookie, así que cambiar la contraseña
// cierra todas las sesiones abiertas (como en los demás paneles). Se relee cada minuto,
// porque la cambia otro proceso (`node src/cli.js clave`).
let currentFp = null;
const fingerprint = hash => (hash ? crypto.createHash('sha256').update(hash).digest('hex').slice(0, 16) : null);

function watch(pool, everyMs = 60000) {
  const load = () => storedHash(pool).then(h => { currentFp = fingerprint(h); }).catch(() => {});
  load();
  return setInterval(load, everyMs);
}

function cookieOk(header) {
  if (!ENABLED) return true;
  const token = readCookie(header, COOKIE);
  if (!token || !currentFp) return false;
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    return p.gate === true && p.fp === currentFp;
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

// ¿Trae una sesión de alguien con cuenta? Quien ya tiene cuenta no necesita la contraseña común
// (entró con una invitación o con la puerta, y su sesión lo dice).
function bearerOk(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return false;
  try {
    return !!jwt.verify(h.slice(7), process.env.JWT_SECRET).userId;
  } catch {
    return false;
  }
}

// Rutas que no pasan por la puerta: salud, la propia puerta, el despertador (tiene su token), ver a
// qué empresa invita un enlace, y entrar o crear cuenta (auth.js exige ahí invitación o contraseña
// propia cuando no se ha pasado la puerta: mira req.gateOpen).
const OPEN = [/^\/api\/health$/, /^\/api\/gate$/, /^\/api\/runner\//, /^\/api\/auth\/(login|register)$/];
const OPEN_GET = [/^\/api\/invitations\/[\w-]+$/];

function middleware(req, res, next) {
  // originalUrl: montado en /api, req.path ya no lleva el prefijo.
  const path = req.originalUrl.split('?')[0];
  req.gateOpen = !ENABLED || cookieOk(req.headers.cookie);
  if (req.gateOpen || bearerOk(req) || OPEN.some(re => re.test(path))
    || (req.method === 'GET' && OPEN_GET.some(re => re.test(path)))) return next();
  res.status(401).json({ error: 'Hace falta la contraseña de la oficina.', code: 'gate' });
}

const fails = new Map(); // ip -> [timestamps]

// Límite de intentos por IP (la puerta y las contraseñas propias): true si ya no deja.
function tooMany(ip, key = 'gate') {
  const now = Date.now();
  const recent = (fails.get(`${key}|${ip}`) || []).filter(t => now - t < WINDOW_MS);
  fails.set(`${key}|${ip}`, recent);
  return recent.length >= MAX_FAILS;
}
function failed(ip, key = 'gate') {
  const k = `${key}|${ip}`;
  fails.set(k, [...(fails.get(k) || []), Date.now()]);
}
function cleared(ip, key = 'gate') { fails.delete(`${key}|${ip}`); }

function router(express) {
  const r = express.Router();

  r.get('/', async (req, res) => {
    res.json({
      required: ENABLED,
      open: cookieOk(req.headers.cookie) || bearerOk(req),
      configured: ENABLED ? !!(await storedHash(req.app.get('db'))) : true,
    });
  });

  r.post('/', async (req, res) => {
    if (!ENABLED) return res.json({ open: true });
    const ip = req.ip;
    if (tooMany(ip)) {
      return res.status(429).json({ error: 'Demasiados intentos. Espera un cuarto de hora.' });
    }
    const stored = await storedHash(req.app.get('db'));
    if (!stored) return res.status(503).json({ error: 'Aún no hay contraseña puesta (clave-paneles).' });
    if (!verifyPassword(String(req.body.password || ''), stored)) {
      failed(ip);
      return res.status(401).json({ error: 'Esa no es.' });
    }
    cleared(ip);
    currentFp = fingerprint(stored);
    const token = jwt.sign({ gate: true, fp: currentFp }, process.env.JWT_SECRET, { expiresIn: MAX_AGE_S });
    const secure = process.env.GATE_INSECURE_COOKIE === 'true' ? '' : '; Secure';
    res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Max-Age=${MAX_AGE_S}; Path=/; HttpOnly; SameSite=Lax${secure}`);
    res.json({ open: true });
  });

  return r;
}

module.exports = { ENABLED, watch, fingerprint, hashPassword, verifyPassword, readCookie, cookieOk, bearerOk, tooMany, failed, cleared, setPassword, middleware, router };
