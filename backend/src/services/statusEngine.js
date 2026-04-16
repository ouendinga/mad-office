/**
 * Motor de Estados v2 - Sistema bipolar de animo
 * Ejes: alegria (tristeza-felicidad), energia (cansancio-energico),
 *        optimismo (pesimismo-optimista), frustracion (frustrado-complacido),
 *        estres (estresado-chill)
 * Valores 0 = negativo, 10 = positivo
 */

const MOOD_FIELDS = ['alegria', 'energia', 'optimismo', 'frustracion', 'estres'];

// Posiciones destino en el mapa (coordenadas logicas 800x600)
const LOCATIONS = {
  reunion: { x: 700, y: 480 },
  lavabo: { x: 730, y: 80 },
  pizarra: { x: 710, y: 85 },
  descanso: { x: 100, y: 480 },
};

// Acciones con condiciones basadas en estado de animo
function evaluateAction(mood) {
  // Prioridad: condiciones mas especificas primero
  if (mood.frustracion <= 3 && mood.alegria < 3) return 'rabieta';
  if (mood.alegria > 7) return 'celebrando';
  if (mood.energia <= 3) return 'durmiendo';
  if (mood.energia > 8) return 'corriendo';
  if (mood.optimismo >= 7) return 'lavabo';
  if (mood.estres < 4) return 'paseando';
  if (mood.energia < 5 && mood.energia > 3) return 'holgazaneando';
  return 'sentado';
}

// Representaciones con condiciones
function evaluateRepresentation(mood) {
  const representations = [];
  if (mood.alegria <= 3) representations.push('llorando');
  if (mood.frustracion <= 3) representations.push('enfadado');
  if (mood.energia <= 3) representations.push('somnoliento');
  if (mood.alegria >= 7) representations.push('cantando');
  if (mood.optimismo <= 4) representations.push('tirandose_del_pelo');
  if (mood.estres <= 4) representations.push('nube_en_la_cabeza');

  if (representations.length === 0) return null;
  // Elegir una representacion aleatoria de las posibles
  return representations[Math.floor(Math.random() * representations.length)];
}

class StatusEngine {
  constructor(pool, io, mockIntegrations) {
    this.pool = pool;
    this.io = io;
    this.mockIntegrations = mockIntegrations;
    this.interval = null;
    this.connectedUsers = new Set();
    // Hora virtual: 1 minuto real = 1 hora virtual, empieza a las 9:00
    this.virtualHour = 9;
    this.virtualMinute = 0;
    this.lastRealTime = Date.now();
  }

  start() {
    console.log('Motor de Estados iniciado - tick cada 15 segundos');
    this.interval = setInterval(() => this.tick(), 15000);
    setTimeout(() => this.tick(), 3000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  setConnectedUsers(userIds) {
    this.connectedUsers = new Set(userIds);
  }

  addConnectedUser(userId) {
    this.connectedUsers.add(userId);
  }

  removeConnectedUser(userId) {
    this.connectedUsers.delete(userId);
  }

  updateVirtualClock() {
    const now = Date.now();
    const elapsedMs = now - this.lastRealTime;
    this.lastRealTime = now;
    // 1 minuto real = 1 hora virtual
    const virtualMinutesElapsed = (elapsedMs / 60000) * 60;
    this.virtualMinute += virtualMinutesElapsed;
    while (this.virtualMinute >= 60) {
      this.virtualMinute -= 60;
      this.virtualHour++;
    }
    if (this.virtualHour >= 24) this.virtualHour -= 24;
  }

  isWorkingHours() {
    return true; // Oficina siempre abierta
  }

  async tick() {
    try {
      this.updateVirtualClock();

      // Emitir hora virtual
      this.io.emit('clock:update', {
        hour: Math.floor(this.virtualHour),
        minute: Math.floor(this.virtualMinute),
        working: this.isWorkingHours()
      });

      if (!this.isWorkingHours()) return;

      // Solo procesar usuarios conectados
      const connectedIds = Array.from(this.connectedUsers);
      if (connectedIds.length === 0) return;

      for (const userId of connectedIds) {
        // 40% probabilidad de generar evento por usuario por tick
        if (Math.random() < 0.4) {
          const event = await this.mockIntegrations.generateRandomEvent(userId);
          if (event) {
            await this.applyMoodImpact(userId, event.moodImpact);
            this.io.emit('event:new', event);
          }
        }

        await this.checkActionTransition(userId);
        await this.checkRepresentations(userId);
      }

      await this.broadcastStates();
    } catch (err) {
      console.error('Error en tick del Motor de Estados:', err);
    }
  }

  async applyMoodImpact(userId, impact) {
    const updates = [];
    const values = [userId];
    let paramIndex = 2;

    for (const field of MOOD_FIELDS) {
      if (impact[field] !== undefined) {
        updates.push(`${field} = GREATEST(0, LEAST(10, ${field} + $${paramIndex}))`);
        values.push(impact[field]);
        paramIndex++;
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      await this.pool.query(
        `UPDATE mood_states SET ${updates.join(', ')} WHERE user_id = $1`,
        values
      );
    }
  }

  async checkActionTransition(userId) {
    const result = await this.pool.query(
      'SELECT * FROM mood_states WHERE user_id = $1',
      [userId]
    );
    if (result.rows.length === 0) return;

    const mood = result.rows[0];
    const minutesSinceAction = (Date.now() - new Date(mood.action_started_at).getTime()) / 60000;

    const shouldTransition = minutesSinceAction >= 30 || this.significantMoodChange(mood);

    if (shouldTransition) {
      const newAction = evaluateAction(mood);
      if (newAction !== mood.current_action) {
        // Calcular posicion destino si es accion de movimiento
        let targetX = null;
        let targetY = null;

        if (LOCATIONS[newAction === 'reunido' ? 'reunion' : newAction]) {
          const loc = LOCATIONS[newAction === 'reunido' ? 'reunion' : newAction];
          targetX = loc.x + (Math.random() * 30 - 15);
          targetY = loc.y + (Math.random() * 30 - 15);
        } else if (newAction === 'paseando' || newAction === 'corriendo') {
          targetX = 50 + Math.random() * 700;
          targetY = 50 + Math.random() * 500;
        }

        await this.pool.query(
          'UPDATE mood_states SET current_action = $1, action_started_at = NOW(), updated_at = NOW() WHERE user_id = $2',
          [newAction, userId]
        );

        if (targetX !== null) {
          await this.pool.query(
            'UPDATE users SET position_x = $1, position_y = $2 WHERE id = $3',
            [targetX, targetY, userId]
          );
        } else {
          // Volver al escritorio
          const userResult = await this.pool.query('SELECT desk_index FROM users WHERE id = $1', [userId]);
          if (userResult.rows.length > 0) {
            await this.pool.query(
              'UPDATE users SET position_x = NULL, position_y = NULL WHERE id = $1',
              [userId]
            );
          }
        }

        this.io.emit('action:changed', { userId, action: newAction, targetX, targetY });
      }
    }
  }

  significantMoodChange(mood) {
    return mood.alegria <= 2 || mood.alegria >= 8 ||
           mood.energia <= 2 || mood.energia >= 8 ||
           mood.frustracion <= 2 || mood.estres <= 2;
  }

  async checkRepresentations(userId) {
    const result = await this.pool.query(
      'SELECT * FROM mood_states WHERE user_id = $1',
      [userId]
    );
    if (result.rows.length === 0) return;

    const mood = result.rows[0];
    const representation = evaluateRepresentation(mood);

    if (representation && representation !== mood.current_representation) {
      // Probabilidad de que se active (30%)
      if (Math.random() < 0.3) {
        await this.pool.query(
          'UPDATE mood_states SET current_representation = $1, updated_at = NOW() WHERE user_id = $2',
          [representation, userId]
        );
        this.io.emit('representation:triggered', {
          userId,
          representation,
        });
      }
    } else if (!representation && mood.current_representation) {
      // Limpiar representacion si ya no aplica
      await this.pool.query(
        'UPDATE mood_states SET current_representation = NULL, updated_at = NOW() WHERE user_id = $1',
        [userId]
      );
    }
  }

  async broadcastStates() {
    const connectedIds = Array.from(this.connectedUsers);
    if (connectedIds.length === 0) {
      this.io.emit('state:update', []);
      return;
    }

    const result = await this.pool.query(`
      SELECT u.id, u.name, u.desk_index, u.avatar_config, u.position_x, u.position_y,
             m.alegria, m.energia, m.optimismo, m.frustracion, m.estres,
             m.current_action, m.current_representation
      FROM users u
      LEFT JOIN mood_states m ON u.id = m.user_id
      WHERE u.id = ANY($1)
      ORDER BY u.desk_index NULLS LAST
    `, [connectedIds]);
    this.io.emit('state:update', result.rows);
  }
}

module.exports = StatusEngine;
