/**
 * Status Engine - Processes mock integration events and updates user mood states.
 * Runs every 15 seconds, generates events and recalculates moods.
 * Also handles action transitions based on mood and time thresholds.
 */

const ACTIONS = {
  sitting: { moods: ['default'], duration: 30 },
  working_hard: { moods: ['stress', 'excitement'], duration: 25 },
  slacking: { moods: ['tiredness', 'sadness'], duration: 20 },
  celebrating: { moods: ['happiness', 'excitement'], duration: 5 },
  pacing: { moods: ['frustration', 'stress'], duration: 10 },
  sleeping: { moods: ['tiredness'], duration: 15 },
  crying: { moods: ['sadness'], duration: 10 },
  raging: { moods: ['frustration'], duration: 5 },
};

const REPRESENTATIONS = {
  happiness: [
    { name: 'smiling', threshold: 4, probability: 0.1 },
    { name: 'sparkles', threshold: 7, probability: 0.2 },
    { name: 'dancing', threshold: 9, probability: 0.3 },
  ],
  stress: [
    { name: 'sweat_drop', threshold: 4, probability: 0.1 },
    { name: 'steam', threshold: 7, probability: 0.2 },
    { name: 'hair_pulling', threshold: 9, probability: 0.3 },
  ],
  frustration: [
    { name: 'anger_cloud', threshold: 4, probability: 0.1 },
    { name: 'red_face', threshold: 7, probability: 0.2 },
    { name: 'table_flip', threshold: 9, probability: 0.3 },
  ],
  excitement: [
    { name: 'bouncing', threshold: 4, probability: 0.1 },
    { name: 'stars', threshold: 7, probability: 0.2 },
    { name: 'fireworks', threshold: 9, probability: 0.3 },
  ],
  sadness: [
    { name: 'tear', threshold: 4, probability: 0.1 },
    { name: 'rain_cloud', threshold: 7, probability: 0.2 },
    { name: 'flooding_tears', threshold: 9, probability: 0.3 },
  ],
  tiredness: [
    { name: 'yawning', threshold: 4, probability: 0.1 },
    { name: 'zzz_bubbles', threshold: 7, probability: 0.2 },
    { name: 'sleeping_standing', threshold: 9, probability: 0.3 },
  ]
};

class StatusEngine {
  constructor(pool, io, mockIntegrations) {
    this.pool = pool;
    this.io = io;
    this.mockIntegrations = mockIntegrations;
    this.interval = null;
  }

  start() {
    console.log('Status Engine started - polling every 15 seconds');
    this.interval = setInterval(() => this.tick(), 15000);
    // Run first tick after 3 seconds to let things initialize
    setTimeout(() => this.tick(), 3000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async tick() {
    try {
      const usersResult = await this.pool.query('SELECT id FROM users');
      const users = usersResult.rows;

      for (const user of users) {
        // 40% chance to generate an event per user per tick
        if (Math.random() < 0.4) {
          const event = await this.mockIntegrations.generateRandomEvent(user.id);
          if (event) {
            await this.applyMoodImpact(user.id, event.moodImpact);
            this.io.emit('event:new', event);
          }
        }

        // Check if action needs to change
        await this.checkActionTransition(user.id);

        // Check for representation triggers
        await this.checkRepresentations(user.id);
      }

      // Emit updated states to all clients
      await this.broadcastStates();
    } catch (err) {
      console.error('StatusEngine tick error:', err);
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

  async checkActionTransition(userId) {
    const result = await this.pool.query(
      'SELECT * FROM mood_states WHERE user_id = $1',
      [userId]
    );
    if (result.rows.length === 0) return;

    const mood = result.rows[0];
    const minutesSinceAction = (Date.now() - new Date(mood.action_started_at).getTime()) / 60000;

    // Check if 30 minutes have passed or mood changed significantly
    const shouldTransition = minutesSinceAction >= 30 || this.significantMoodChange(mood);

    if (shouldTransition) {
      const newAction = this.determineAction(mood);
      if (newAction !== mood.current_action) {
        await this.pool.query(
          'UPDATE mood_states SET current_action = $1, action_started_at = NOW(), updated_at = NOW() WHERE user_id = $2',
          [newAction, userId]
        );
        this.io.emit('action:changed', { userId, action: newAction });
      }
    }
  }

  significantMoodChange(mood) {
    // Consider a mood significant if any value is >= 7 or <= 2
    return mood.happiness >= 8 || mood.stress >= 7 || mood.frustration >= 7 ||
           mood.sadness >= 7 || mood.tiredness >= 8 || mood.excitement >= 8;
  }

  determineAction(mood) {
    const dominant = this.getDominantMood(mood);

    const actionMap = {
      happiness: ['celebrating', 'sitting'],
      stress: ['working_hard', 'pacing'],
      frustration: ['pacing', 'raging'],
      excitement: ['celebrating', 'working_hard'],
      sadness: ['crying', 'slacking'],
      tiredness: ['sleeping', 'slacking'],
    };

    const options = actionMap[dominant] || ['sitting'];
    return options[Math.floor(Math.random() * options.length)];
  }

  getDominantMood(mood) {
    const moods = {
      happiness: mood.happiness,
      stress: mood.stress,
      frustration: mood.frustration,
      excitement: mood.excitement,
      sadness: mood.sadness,
      tiredness: mood.tiredness
    };

    let dominant = 'happiness';
    let maxVal = 0;
    for (const [key, val] of Object.entries(moods)) {
      if (val > maxVal) {
        maxVal = val;
        dominant = key;
      }
    }
    return dominant;
  }

  async checkRepresentations(userId) {
    const result = await this.pool.query(
      'SELECT * FROM mood_states WHERE user_id = $1',
      [userId]
    );
    if (result.rows.length === 0) return;

    const mood = result.rows[0];
    const moodTypes = ['happiness', 'stress', 'frustration', 'excitement', 'sadness', 'tiredness'];

    for (const moodType of moodTypes) {
      const value = mood[moodType];
      const representations = REPRESENTATIONS[moodType] || [];

      for (const repr of representations) {
        if (value >= repr.threshold && Math.random() < repr.probability) {
          await this.pool.query(
            'UPDATE mood_states SET current_representation = $1, updated_at = NOW() WHERE user_id = $2',
            [repr.name, userId]
          );
          this.io.emit('representation:triggered', {
            userId,
            representation: repr.name,
            moodType,
            intensity: value
          });
          break;
        }
      }
    }
  }

  async broadcastStates() {
    const result = await this.pool.query(`
      SELECT u.id, u.name, u.desk_index, u.avatar_config,
             m.happiness, m.stress, m.frustration, m.excitement, m.sadness, m.tiredness,
             m.current_action, m.current_representation
      FROM users u
      LEFT JOIN mood_states m ON u.id = m.user_id
      ORDER BY u.desk_index NULLS LAST
    `);
    this.io.emit('state:update', result.rows);
  }
}

module.exports = StatusEngine;
