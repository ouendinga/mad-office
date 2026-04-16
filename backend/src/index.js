const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const moodRoutes = require('./routes/moods');
const StatusEngine = require('./services/statusEngine');
const MockIntegrations = require('./services/mockIntegrations');
const OfficeEvents = require('./services/officeEvents');
const socketHandler = require('./socket/handler');

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:8081', 'http://localhost:3000'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL no configurada. Configura las variables de entorno.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Middleware
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Make pool and io available to routes
app.set('db', pool);
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/moods', moodRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start services
const mockIntegrations = new MockIntegrations(pool);
const statusEngine = new StatusEngine(pool, io, mockIntegrations);
const officeEvents = new OfficeEvents(pool, io);

// Pass engines to socket handler for presence tracking
socketHandler(io, pool, statusEngine, officeEvents);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Mad Office backend en puerto ${PORT}`);
  statusEngine.start();
  officeEvents.start();
});
