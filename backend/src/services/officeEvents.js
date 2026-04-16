/**
 * Office Events - Random events that occur in the office
 * Events like storms, earthquakes, etc. that affect user moods
 */

const OFFICE_EVENTS = [
  {
    type: 'mini_storm',
    description: 'A small storm cloud appears over {user}!',
    moodImpact: { sadness: 2, stress: 1 },
    probability: 0.05,
    targeted: true,
  },
  {
    type: 'earthquake',
    description: 'A small earthquake shakes the office!',
    moodImpact: { stress: 2, excitement: 1, frustration: 1 },
    probability: 0.02,
    targeted: false,
  },
  {
    type: 'coffee_spill',
    description: '{user} spills coffee on their desk!',
    moodImpact: { frustration: 2, sadness: 1 },
    probability: 0.04,
    targeted: true,
  },
  {
    type: 'pizza_delivery',
    description: 'Pizza delivery for the office!',
    moodImpact: { happiness: 3, excitement: 2, stress: -1 },
    probability: 0.03,
    targeted: false,
  },
  {
    type: 'wifi_outage',
    description: 'The WiFi goes down momentarily!',
    moodImpact: { frustration: 3, stress: 2 },
    probability: 0.02,
    targeted: false,
  },
  {
    type: 'birthday_surprise',
    description: "It's {user}'s birthday! The team sings happy birthday!",
    moodImpact: { happiness: 4, excitement: 3 },
    probability: 0.02,
    targeted: true,
  },
  {
    type: 'plant_grows',
    description: 'The office plant suddenly blooms!',
    moodImpact: { happiness: 1, excitement: 1 },
    probability: 0.04,
    targeted: false,
  },
  {
    type: 'fire_alarm_drill',
    description: 'Fire alarm drill! Everyone looks confused.',
    moodImpact: { stress: 2, frustration: 1, tiredness: 1 },
    probability: 0.01,
    targeted: false,
  },
  {
    type: 'rainbow',
    description: 'A rainbow appears outside the office window!',
    moodImpact: { happiness: 2, sadness: -1 },
    probability: 0.03,
    targeted: false,
  },
  {
    type: 'cat_visit',
    description: 'A stray cat wanders into the office!',
    moodImpact: { happiness: 3, excitement: 2, stress: -2 },
    probability: 0.03,
    targeted: false,
  },
];

class OfficeEvents {
  constructor(pool, io) {
    this.pool = pool;
    this.io = io;
    this.interval = null;
  }

  start() {
    console.log('Office Events started - checking every 30 seconds');
    this.interval = setInterval(() => this.tick(), 30000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async tick() {
    try {
      const usersResult = await this.pool.query('SELECT id, name FROM users');
      const users = usersResult.rows;

      for (const event of OFFICE_EVENTS) {
        if (Math.random() < event.probability) {
          if (event.targeted) {
            const targetUser = users[Math.floor(Math.random() * users.length)];
            const description = event.description.replace('{user}', targetUser.name);

            await this.pool.query(
              'INSERT INTO office_events (event_type, target_user_id, description, mood_impact) VALUES ($1, $2, $3, $4)',
              [event.type, targetUser.id, description, JSON.stringify(event.moodImpact)]
            );

            // Apply mood impact to target user
            await this.applyMoodImpact(targetUser.id, event.moodImpact);

            this.io.emit('office_event', {
              type: event.type,
              description,
              targetUserId: targetUser.id,
              targetUserName: targetUser.name
            });
          } else {
            await this.pool.query(
              'INSERT INTO office_events (event_type, description, mood_impact) VALUES ($1, $2, $3)',
              [event.type, event.description, JSON.stringify(event.moodImpact)]
            );

            // Apply mood impact to all users
            for (const user of users) {
              await this.applyMoodImpact(user.id, event.moodImpact);
            }

            this.io.emit('office_event', {
              type: event.type,
              description: event.description,
              targetUserId: null,
              targetUserName: null
            });
          }
        }
      }
    } catch (err) {
      console.error('OfficeEvents tick error:', err);
    }
  }

  async applyMoodImpact(userId, impact) {
    const moodFields = ['happiness', 'stress', 'frustration', 'excitement', 'sadness', 'tiredness'];
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
