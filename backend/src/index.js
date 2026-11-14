const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const { makePool, migrate } = require('./db');
const { makeClock } = require('./world/clock');
const { Sim } = require('./world/sim');
const auth = require('./routes/auth');
const me = require('./routes/me');
const office = require('./routes/office');
const runner = require('./routes/runner');
const gate = require('./gate');

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:8081,http://localhost:3000').split(',');

async function main() {
  const pool = makePool();
  await migrate(pool);

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: allowedOrigins, credentials: true } });

  // Solo entra al directo quien tiene sesión.
  io.use((socket, next) => {
    if (!gate.cookieOk(socket.handshake.headers.cookie)) return next(new Error('gate'));
    return auth.verify(socket.handshake.auth && socket.handshake.auth.token) ? next() : next(new Error('auth'));
  });

  const clock = makeClock({
    speed: Number(process.env.CLOCK_SPEED || 1),
    start: process.env.CLOCK_START ? Date.parse(process.env.CLOCK_START) : null,
  });
  const sim = new Sim({ pool, io, clock });

  // Detrás de nginx (y en el VPS, además, de Traefik): para que req.ip sea la del visitante.
  app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '64kb' }));
  app.set('db', pool);

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/gate', gate.router(express));
  app.use('/api', gate.middleware);
  app.use('/api/auth', auth.router({ onUsersChanged: () => { sim.invalidate(); sim.ensured.clear(); } }));
  app.use('/api/me', me.router({ sim }));
  app.use('/api/runner', runner.router({ sim }));
  app.use('/api', office.router());

  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error(err);
    res.status(500).json({ error: 'Algo se ha roto en la oficina. Prueba otra vez en un momento.' });
  });

  const port = Number(process.env.PORT || 3001);
  server.listen(port, () => {
    console.log(`Mad Office en el puerto ${port} (reloj x${clock.speed})`);
    sim.start();
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
