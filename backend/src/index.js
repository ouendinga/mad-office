const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const { makePool, migrate } = require('./db');
const { makeClock } = require('./world/clock');
const { World } = require('./world/manager');
const auth = require('./routes/auth');
const companies = require('./routes/companies');
const member = require('./routes/member');
const runner = require('./routes/runner');
const gate = require('./gate');

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:8081,http://localhost:3000').split(',');

async function main() {
  const pool = makePool();
  await migrate(pool);
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: allowedOrigins, credentials: true } });

  const clock = makeClock({
    speed: Number(process.env.CLOCK_SPEED || 1),
    start: process.env.CLOCK_START ? Date.parse(process.env.CLOCK_START) : null,
  });
  const world = new World({ pool, io, clock });

  // Al directo solo entra quien tiene sesión Y es de esa empresa. Cada uno en su sala de usuario
  // (ahí le llegan sus cosas privadas) y en la de la empresa que está mirando.
  io.use(async (socket, next) => {
    if (!gate.cookieOk(socket.handshake.headers.cookie)) return next(new Error('gate'));
    const a = socket.handshake.auth || {};
    const payload = auth.verify(a.token);
    if (!payload) return next(new Error('auth'));
    const cid = Number(a.companyId);
    const m = (await pool.query('SELECT 1 FROM memberships WHERE company_id = $1 AND user_id = $2', [cid, payload.userId])).rows[0];
    if (!m) return next(new Error('no_miembro'));
    socket.data.userId = payload.userId;
    socket.data.companyId = cid;
    return next();
  });
  io.on('connection', socket => {
    socket.join(`user:${socket.data.userId}`);
    socket.join(`company:${socket.data.companyId}`);
  });

  // Detrás de nginx (y en el VPS, además, de Traefik): para que req.ip sea la del visitante.
  app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '64kb' }));
  app.set('db', pool);

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/gate', gate.router(express));
  app.use('/api', gate.middleware);
  app.use('/api/auth', auth.router({ onUsersChanged: () => { for (const s of world.sims.values()) { s.invalidate(); s.ensured.clear(); } } }));
  app.use('/api/runner', runner.router({ world }));
  // Primero lo de fuera de una empresa (crear, públicas, tablón, invitaciones, pedir entrar)…
  app.use('/api', companies.router({ world }));
  // …y luego lo de dentro de una.
  app.use('/api/companies/:cid', member.router({ world }));

  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error(err);
    res.status(500).json({ error: 'Algo se ha roto en la oficina. Prueba otra vez en un momento.' });
  });

  const port = Number(process.env.PORT || 3001);
  server.listen(port, () => {
    console.log(`Mad Office en el puerto ${port} (reloj x${clock.speed})`);
    world.start().catch(e => console.error('arranque de oficinas:', e));
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
