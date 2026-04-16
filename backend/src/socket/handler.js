const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'REDACTED_JWT_SECRET';

function socketHandler(io, pool) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Authenticate socket connection
    socket.on('auth', async (token) => {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.userId;
        socket.join('office');

        // Send current state to newly connected client
        const result = await pool.query(`
          SELECT u.id, u.name, u.desk_index, u.avatar_config,
                 m.happiness, m.stress, m.frustration, m.excitement, m.sadness, m.tiredness,
                 m.current_action, m.current_representation
          FROM users u
          LEFT JOIN mood_states m ON u.id = m.user_id
          ORDER BY u.desk_index NULLS LAST
        `);
        socket.emit('state:update', result.rows);
        socket.emit('auth:success', { userId: decoded.userId });

        io.emit('user:online', { userId: decoded.userId });
      } catch (err) {
        socket.emit('auth:error', { error: 'Invalid token' });
      }
    });

    // Handle emoji reactions (Phase II)
    socket.on('reaction:send', (data) => {
      if (socket.userId) {
        io.emit('reaction:new', {
          userId: socket.userId,
          emoji: data.emoji,
          timestamp: Date.now()
        });
      }
    });

    // Handle chat messages (Phase II)
    socket.on('chat:send', async (data) => {
      if (socket.userId) {
        try {
          const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [socket.userId]);
          const userName = userResult.rows[0]?.name || 'Unknown';

          io.emit('chat:message', {
            userId: socket.userId,
            userName,
            message: data.message,
            timestamp: Date.now()
          });
        } catch (err) {
          console.error('Chat error:', err);
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      if (socket.userId) {
        io.emit('user:offline', { userId: socket.userId });
      }
    });
  });
}

module.exports = socketHandler;
