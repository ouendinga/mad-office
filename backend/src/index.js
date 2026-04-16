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

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://madoffice:REDACTED_DB_PASSWORD@localhost:5432/madoffice'
});

// Middleware
app.use(cors());
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

// WebSocket handling
socketHandler(io, pool);

// Start services
const mockIntegrations = new MockIntegrations(pool);
const statusEngine = new StatusEngine(pool, io, mockIntegrations);
const officeEvents = new OfficeEvents(pool, io);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Mad Office backend running on port ${PORT}`);
  statusEngine.start();
  officeEvents.start();
});
