/**
 * Mock Integrations - Simulates real API events from Jira, Gmail, Google Calendar
 * Generates random events for users every 15 seconds
 */
class MockIntegrations {
  constructor(pool) {
    this.pool = pool;

    this.eventTemplates = {
      jira: [
        { type: 'ticket_assigned', description: 'New ticket assigned: Bug fix in payment module', mood: { stress: 2, frustration: 1 } },
        { type: 'ticket_completed', description: 'Ticket marked as done: User dashboard redesign', mood: { happiness: 3, excitement: 2, stress: -2 } },
        { type: 'ticket_blocked', description: 'Ticket blocked by dependency', mood: { frustration: 3, stress: 2 } },
        { type: 'sprint_started', description: 'New sprint started: Sprint 14', mood: { excitement: 2, stress: 1 } },
        { type: 'code_review_requested', description: 'Pull request needs your review', mood: { stress: 1 } },
        { type: 'bug_reported', description: 'Critical bug reported in production', mood: { stress: 4, frustration: 2, happiness: -2 } },
        { type: 'ticket_reopened', description: 'Previously closed ticket reopened', mood: { frustration: 3, sadness: 1 } },
        { type: 'deployment_success', description: 'Deployment to production successful', mood: { happiness: 3, excitement: 2, stress: -3 } },
      ],
      gmail: [
        { type: 'email_urgent', description: 'Urgent email from management about deadline', mood: { stress: 3, frustration: 1 } },
        { type: 'email_praise', description: 'Email: Great job on the presentation!', mood: { happiness: 4, excitement: 2 } },
        { type: 'email_meeting', description: 'Meeting scheduled: Quarterly review', mood: { stress: 2, tiredness: 1 } },
        { type: 'email_spam', description: '15 unread promotional emails', mood: { frustration: 1 } },
        { type: 'email_feedback', description: 'Positive client feedback received', mood: { happiness: 3, excitement: 1 } },
        { type: 'email_complaint', description: 'Client complaint about delayed feature', mood: { stress: 3, sadness: 2, frustration: 1 } },
      ],
      calendar: [
        { type: 'meeting_start', description: 'Stand-up meeting starting in 5 minutes', mood: { stress: 1 } },
        { type: 'meeting_cancelled', description: 'Afternoon meeting cancelled', mood: { happiness: 2, stress: -2, tiredness: -1 } },
        { type: 'meeting_overrun', description: 'Meeting running 30 minutes over schedule', mood: { tiredness: 3, frustration: 2, stress: 1 } },
        { type: 'lunch_break', description: 'Lunch break reminder', mood: { happiness: 2, tiredness: -2, stress: -1 } },
        { type: 'deadline_approaching', description: 'Project deadline in 2 hours', mood: { stress: 4, frustration: 1 } },
        { type: 'free_slot', description: 'No meetings for next 2 hours', mood: { happiness: 2, stress: -2 } },
      ]
    };
  }

  async generateRandomEvent(userId) {
    const sources = Object.keys(this.eventTemplates);
    const source = sources[Math.floor(Math.random() * sources.length)];
    const templates = this.eventTemplates[source];
    const template = templates[Math.floor(Math.random() * templates.length)];

    try {
      await this.pool.query(
        'INSERT INTO mock_events (user_id, event_type, source, description, mood_impact) VALUES ($1, $2, $3, $4, $5)',
        [userId, template.type, source, template.description, JSON.stringify(template.mood)]
      );

      return {
        userId,
        eventType: template.type,
        source,
        description: template.description,
        moodImpact: template.mood
      };
    } catch (err) {
      console.error('Error generating mock event:', err);
      return null;
    }
  }

  async getRecentEvents(userId, limit = 5) {
    const result = await this.pool.query(
      'SELECT * FROM mock_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return result.rows;
  }
}

module.exports = MockIntegrations;
