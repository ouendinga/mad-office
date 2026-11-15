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
// Ojo: además de firmada, la cuenta tiene que existir (una sesión vieja de una base borrada dejaba
// pasar la puerta y luego no se podía crear la cuenta: 2026-11-14).
async function bearerOk(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return false;
  let id;
  try {
    id = jwt.verify(h.slice(7), process.env.JWT_SECRET).userId;
  } catch {
    return false;
  }
  if (!id) return false;
  const r = await req.app.get('db').query('SELECT 1 FROM users WHERE id = $1', [id]);
  return r.rows.length > 0;
}

// Rutas que no pasan por la puerta: salud, la propia puerta, el despertador (tiene su token), ver a
// qué empresa invita un enlace, y entrar o crear cuenta (auth.js exige ahí invitación o contraseña
// propia cuando no se ha pasado la puerta: mira req.gateOpen).
const OPEN = [/^\/api\/health$/, /^\/api\/gate(\/sso)?$/, /^\/api\/runner\//, /^\/api\/auth\/(login|register)$/];
const OPEN_GET = [/^\/api\/invitations\/[\w-]+$/];

async function middleware(req, res, next) {
  // originalUrl: montado en /api, req.path ya no lleva el prefijo.
  const path = req.originalUrl.split('?')[0];
  req.gateOpen = !ENABLED || cookieOk(req.headers.cookie);
  if (req.gateOpen || OPEN.some(re => re.test(path))
    || (req.method === 'GET' && OPEN_GET.some(re => re.test(path)))) return next();
  try {
    if (await bearerOk(req)) return next();
  } catch (e) {
    return next(e);
  }
  res.status(401).json({ error: 'Hace falta la contraseña de la oficina.', code: 'gate' });
}

// ---- Entrar desde dashboard.alvarosolis.dev con billete (sin volver a teclear la contraseña) ----
// El panel firma con Ed25519; aquí solo está su clave PÚBLICA (/sso/dashboard.pub, de solo lectura): sirve para
// comprobar un billete, no para fabricarlo. Contrato: ~/projects/dashboard/docs/sso.md. El billete abre la PUERTA
// (lo mismo que la contraseña común); la cuenta de cada uno dentro de la oficina sigue siendo la suya.
const ORIGEN_PANEL = 'https://dashboard.alvarosolis.dev';
const SSO_AUD = process.env.SSO_AUD || 'https://mad-office.alvarosolis.dev';
let ssoClave;
function clavePanel() {
  if (ssoClave === undefined) {
    try {
      const k = crypto.createPublicKey(require('fs').readFileSync(process.env.SSO_PUBLICA || '/sso/dashboard.pub'));
      ssoClave = k.asymmetricKeyType === 'ed25519' ? k : null;
    } catch { ssoClave = null; }
  }
  return ssoClave;
}
const ssoUsados = new Map(); // jti -> exp

// '' si el billete vale (y queda gastado); si no, el motivo.
function comprobarBillete(texto, ahora = Math.floor(Date.now() / 1000), clave = clavePanel()) {
  for (const [j, exp] of ssoUsados) if (exp < ahora) ssoUsados.delete(j);
  const partes = String(texto || '').split('.');
  if (partes.length !== 3 || partes[0] !== 'v1') return 'formato';
  const [, datos, firma] = partes;
  let ok = false;
  try { ok = crypto.verify(null, Buffer.from(`v1.${datos}`), clave, Buffer.from(firma, 'base64url')); } catch { ok = false; }
  if (!ok) return 'firma';
  let d;
  try { d = JSON.parse(Buffer.from(datos, 'base64url').toString('utf8')); } catch { return 'formato'; }
  if (d.aud !== SSO_AUD) return 'destino';
  if (!Number.isInteger(d.iat) || !Number.isInteger(d.exp) || d.exp - d.iat > 120 || d.iat > ahora + 30) return 'fechas';
  if (ahora > d.exp) return 'caducado';
  if (typeof d.jti !== 'string' || d.jti.length < 16 || ssoUsados.has(d.jti)) return 'repetido';
  ssoUsados.set(d.jti, d.exp);
  return '';
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

// Cookie de la puerta abierta (con la huella de la contraseña vigente).
function abrir(res, stored) {
  currentFp = fingerprint(stored);
  const token = jwt.sign({ gate: true, fp: currentFp }, process.env.JWT_SECRET, { expiresIn: MAX_AGE_S });
  const secure = process.env.GATE_INSECURE_COOKIE === 'true' ? '' : '; Secure';
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Max-Age=${MAX_AGE_S}; Path=/; HttpOnly; SameSite=Lax${secure}`);
}

function router(express) {
  const r = express.Router();

  r.get('/', async (req, res) => {
    res.json({
      required: ENABLED,
      open: cookieOk(req.headers.cookie) || (await bearerOk(req)),
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
    abrir(res, stored);
    res.json({ open: true });
  });

  // POST /api/gate/sso (nginx lo publica como /sso): billete del panel. Un billete falso cuenta como contraseña mala.
  r.post('/sso', express.urlencoded({ extended: false, limit: '4kb' }), async (req, res) => {
    if (!ENABLED) return res.redirect(303, '/');
    if (!clavePanel()) return res.status(404).send('No existe');
    const ip = req.ip;
    if (tooMany(ip)) return res.status(429).send('Demasiados intentos. Espera un cuarto de hora.');
    const motivo = req.headers.origin === ORIGEN_PANEL ? comprobarBillete(req.body && req.body.billete) : 'origen';
    const stored = motivo ? null : await storedHash(req.app.get('db'));
    if (motivo || !stored) {
      failed(ip);
      console.warn(`sso: billete rechazado (${motivo || 'sin contraseña puesta'}) desde ${ip}`);
      return res.status(403).send('No se ha podido entrar desde el panel: entra con la contraseña.');
    }
    abrir(res, stored);
    res.redirect(303, '/');
  });

  return r;
}

module.exports = { comprobarBillete, ENABLED, watch, fingerprint, hashPassword, verifyPassword, readCookie, cookieOk, bearerOk, tooMany, failed, cleared, setPassword, middleware, router };
