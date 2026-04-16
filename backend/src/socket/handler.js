const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function socketHandler(io, pool, statusEngine, officeEvents) {
  const connectedSockets = new Map(); // socketId -> userId
  const userSockets = new Map(); // userId -> Set<socketId>

  io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    socket.on('auth', async (token) => {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;
        socket.userId = userId;
        socket.join('office');

        // Track connection
        connectedSockets.set(socket.id, userId);
        if (!userSockets.has(userId)) userSockets.set(userId, new Set());
        userSockets.get(userId).add(socket.id);

        // Update presence in engines
        statusEngine.addConnectedUser(userId);
        officeEvents.setConnectedUsers(statusEngine.connectedUsers);

        // Send current state (only connected users)
        const connectedIds = Array.from(statusEngine.connectedUsers);
        const result = await pool.query(`
          SELECT u.id, u.name, u.desk_index, u.avatar_config, u.position_x, u.position_y,
                 m.alegria, m.energia, m.optimismo, m.frustracion, m.estres,
                 m.current_action, m.current_representation
          FROM users u
          LEFT JOIN mood_states m ON u.id = m.user_id
          WHERE u.id = ANY($1)
          ORDER BY u.desk_index NULLS LAST
        `, [connectedIds]);
        socket.emit('state:update', result.rows);
        socket.emit('auth:success', { userId });

        // Load recent chat messages
        const chatResult = await pool.query(`
          SELECT cm.id, cm.message, cm.created_at, u.name as user_name, u.id as user_id
          FROM chat_messages cm
          JOIN users u ON cm.user_id = u.id
          ORDER BY cm.created_at DESC LIMIT 50
        `);
        socket.emit('chat:history', chatResult.rows.reverse());

        io.emit('user:online', { userId });
        // Broadcast updated state to everyone
        await statusEngine.broadcastStates();
      } catch (err) {
        socket.emit('auth:error', { error: 'Token invalido' });
      }
    });

    // Manual position update from client
    socket.on('position:update', async (data) => {
      if (!socket.userId) return;
      const { x, y, moving } = data;
      if (typeof x !== 'number' || typeof y !== 'number') return;

      try {
        await pool.query(
          'UPDATE users SET position_x = $1, position_y = $2 WHERE id = $3',
          [Math.round(x), Math.round(y), socket.userId]
        );

        // Broadcast to all other clients
        socket.broadcast.to('office').emit('position:remote', {
          userId: socket.userId,
          x, y, moving
        });
      } catch (err) {
        console.error('Error actualizando posicion:', err);
      }
    });

    // Emoji reactions
    socket.on('reaction:send', (data) => {
      if (socket.userId) {
        io.emit('reaction:new', {
          userId: socket.userId,
          emoji: data.emoji,
          timestamp: Date.now()
        });
      }
    });

    // Chat messages
    socket.on('chat:send', async (data) => {
      if (socket.userId && data.message && data.message.trim()) {
        try {
          const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [socket.userId]);
          const userName = userResult.rows[0]?.name || 'Desconocido';

          // Persist message
          await pool.query(
            'INSERT INTO chat_messages (user_id, message) VALUES ($1, $2)',
            [socket.userId, data.message.trim()]
          );

          io.emit('chat:message', {
            userId: socket.userId,
            userName,
            message: data.message.trim(),
            timestamp: Date.now()
          });
        } catch (err) {
          console.error('Error en chat:', err);
        }
      }
    });

    socket.on('disconnect', async () => {
      console.log('Cliente desconectado:', socket.id);
      const userId = connectedSockets.get(socket.id);
      connectedSockets.delete(socket.id);

      if (userId) {
        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);
            statusEngine.removeConnectedUser(userId);
            officeEvents.setConnectedUsers(statusEngine.connectedUsers);
            io.emit('user:offline', { userId });
            await statusEngine.broadcastStates();
          }
        }
      }
    });
  });
}

module.exports = socketHandler;
