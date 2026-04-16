/**
 * Eventos de Oficina - Eventos aleatorios que ocurren en la oficina
 * Sistema bipolar: positivo sube el eje, negativo lo baja
 */

const OFFICE_EVENTS = [
  {
    type: 'mini_tormenta',
    description: 'Una pequena nube de tormenta aparece sobre {user}!',
    moodImpact: { alegria: -2, estres: -1 },
    probability: 0.05,
    targeted: true,
  },
  {
    type: 'terremoto',
    description: 'Un pequeno terremoto sacude la oficina!',
    moodImpact: { estres: -2, energia: 1, frustracion: -1 },
    probability: 0.02,
    targeted: false,
  },
  {
    type: 'cafe_derramado',
    description: '{user} derrama cafe en su escritorio!',
    moodImpact: { frustracion: -2, alegria: -1 },
    probability: 0.04,
    targeted: true,
  },
  {
    type: 'entrega_pizza',
    description: 'Entrega de pizza para la oficina!',
    moodImpact: { alegria: 3, energia: 2, estres: 1 },
    probability: 0.03,
    targeted: false,
  },
  {
    type: 'caida_wifi',
    description: 'El WiFi se cae momentaneamente!',
    moodImpact: { frustracion: -3, estres: -2 },
    probability: 0.02,
    targeted: false,
  },
  {
    type: 'sorpresa_cumpleanos',
    description: 'Es el cumpleanos de {user}! El equipo le canta!',
    moodImpact: { alegria: 4, energia: 3 },
    probability: 0.02,
    targeted: true,
  },
  {
    type: 'planta_florece',
    description: 'La planta de la oficina florece de repente!',
    moodImpact: { alegria: 1, optimismo: 2 },
    probability: 0.04,
    targeted: false,
  },
  {
    type: 'simulacro_incendio',
    description: 'Simulacro de incendio! Todos parecen confundidos.',
    moodImpact: { estres: -2, frustracion: -1, energia: -1 },
    probability: 0.01,
    targeted: false,
  },
  {
    type: 'arcoiris',
    description: 'Un arcoiris aparece fuera de la ventana de la oficina!',
    moodImpact: { alegria: 2, optimismo: 2 },
    probability: 0.03,
    targeted: false,
  },
  {
    type: 'visita_gato',
    description: 'Un gato callejero entra en la oficina!',
    moodImpact: { alegria: 3, energia: 2, estres: 2 },
    probability: 0.03,
    targeted: false,
  },
  {
    type: 'brainstorming',
    description: 'Sesion de brainstorming en la pizarra! {user} va a la pizarra.',
    moodImpact: { energia: 2, optimismo: 1 },
    probability: 0.04,
    targeted: true,
    moveTo: 'pizarra',
  },
  {
    type: 'reunion_improvisada',
    description: 'Reunion improvisada! Varios se juntan en la sala de reuniones.',
    moodImpact: { estres: -1, energia: -1 },
    probability: 0.03,
    targeted: false,
    moveTo: 'reunion',
  },
];

class OfficeEvents {
  constructor(pool, io) {
    this.pool = pool;
    this.io = io;
    this.interval = null;
    this.connectedUsers = new Set();
  }

  start() {
    console.log('Eventos de Oficina iniciados - tick cada 30 segundos');
    this.interval = setInterval(() => this.tick(), 30000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  setConnectedUsers(users) {
    this.connectedUsers = users;
  }

  async tick() {
    try {
      const connectedIds = Array.from(this.connectedUsers);
      if (connectedIds.length === 0) return;

      const usersResult = await this.pool.query(
        'SELECT id, name FROM users WHERE id = ANY($1)',
        [connectedIds]
      );
      const users = usersResult.rows;
      if (users.length === 0) return;

      for (const event of OFFICE_EVENTS) {
        if (Math.random() < event.probability) {
          if (event.targeted) {
            const targetUser = users[Math.floor(Math.random() * users.length)];
            const description = event.description.replace('{user}', targetUser.name);

            await this.pool.query(
              'INSERT INTO office_events (event_type, target_user_id, description, mood_impact) VALUES ($1, $2, $3, $4)',
              [event.type, targetUser.id, description, JSON.stringify(event.moodImpact)]
            );

            await this.applyMoodImpact(targetUser.id, event.moodImpact);

            // Mover avatar si el evento lo requiere
            if (event.moveTo) {
              await this.pool.query(
                'UPDATE mood_states SET current_action = $1, action_started_at = NOW() WHERE user_id = $2',
                [event.moveTo, targetUser.id]
              );
            }

            this.io.emit('office_event', {
              type: event.type,
              description,
              targetUserId: targetUser.id,
              targetUserName: targetUser.name,
              moveTo: event.moveTo || null,
            });
          } else {
            await this.pool.query(
              'INSERT INTO office_events (event_type, description, mood_impact) VALUES ($1, $2, $3)',
              [event.type, event.description, JSON.stringify(event.moodImpact)]
            );

            for (const user of users) {
              await this.applyMoodImpact(user.id, event.moodImpact);
            }

            if (event.moveTo) {
              // Mover usuarios aleatorios a la ubicacion
              const movedUsers = users.slice(0, Math.min(3, users.length));
              for (const u of movedUsers) {
                await this.pool.query(
                  'UPDATE mood_states SET current_action = $1, action_started_at = NOW() WHERE user_id = $2',
                  [event.moveTo === 'reunion' ? 'reunido' : event.moveTo, u.id]
                );
              }
            }

            this.io.emit('office_event', {
              type: event.type,
              description: event.description,
              targetUserId: null,
              targetUserName: null,
              moveTo: event.moveTo || null,
            });
          }
        }
      }
    } catch (err) {
      console.error('Error en tick de Eventos de Oficina:', err);
    }
  }

  async applyMoodImpact(userId, impact) {
    const moodFields = ['alegria', 'energia', 'optimismo', 'frustracion', 'estres'];
    const updates = [];
    const values = [userId];
    let paramIndex = 2;

    for (const field of moodFields) {
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
}

module.exports = OfficeEvents;
