/**
 * Integraciones Mock - Simula eventos de Jira, Gmail, Google Calendar
 * Genera eventos aleatorios cada 15 segundos
 * Sistema bipolar: valores positivos suben el eje, negativos lo bajan
 */
class MockIntegrations {
  constructor(pool) {
    this.pool = pool;

    this.eventTemplates = {
      jira: [
        { type: 'ticket_asignado', description: 'Nuevo ticket asignado: Corregir bug en modulo de pagos', mood: { estres: -2, frustracion: -1 } },
        { type: 'ticket_completado', description: 'Ticket marcado como hecho: Rediseno del dashboard', mood: { alegria: 3, energia: 1, estres: 2 } },
        { type: 'ticket_bloqueado', description: 'Ticket bloqueado por dependencia', mood: { frustracion: -3, estres: -2 } },
        { type: 'sprint_iniciado', description: 'Nuevo sprint iniciado: Sprint 14', mood: { energia: 2, estres: -1 } },
        { type: 'revision_codigo', description: 'Pull request necesita tu revision', mood: { estres: -1 } },
        { type: 'bug_produccion', description: 'Bug critico reportado en produccion', mood: { estres: -4, frustracion: -2, alegria: -2 } },
        { type: 'ticket_reabierto', description: 'Ticket previamente cerrado fue reabierto', mood: { frustracion: -3, alegria: -1 } },
        { type: 'despliegue_exitoso', description: 'Despliegue a produccion exitoso', mood: { alegria: 3, energia: 2, estres: 3 } },
      ],
      gmail: [
        { type: 'email_urgente', description: 'Email urgente de direccion sobre fecha limite', mood: { estres: -3, frustracion: -1 } },
        { type: 'email_reconocimiento', description: 'Email: Excelente trabajo en la presentacion!', mood: { alegria: 4, energia: 2 } },
        { type: 'email_reunion', description: 'Reunion programada: Revision trimestral', mood: { estres: -2, energia: -1 } },
        { type: 'email_spam', description: '15 correos promocionales sin leer', mood: { frustracion: -1 } },
        { type: 'email_feedback', description: 'Feedback positivo del cliente recibido', mood: { alegria: 3, optimismo: 2 } },
        { type: 'email_queja', description: 'Queja del cliente por funcionalidad retrasada', mood: { estres: -3, alegria: -2, frustracion: -1 } },
      ],
      calendar: [
        { type: 'reunion_inicio', description: 'Daily stand-up empieza en 5 minutos', mood: { estres: -1 } },
        { type: 'reunion_cancelada', description: 'Reunion de la tarde cancelada', mood: { alegria: 2, estres: 2, energia: 1 } },
        { type: 'reunion_extendida', description: 'Reunion se extiende 30 minutos sobre lo previsto', mood: { energia: -3, frustracion: -2, estres: -1 } },
        { type: 'hora_almuerzo', description: 'Recordatorio de hora de almuerzo', mood: { alegria: 2, energia: 2, estres: 1 } },
        { type: 'deadline_cercano', description: 'Fecha limite del proyecto en 2 horas', mood: { estres: -4, frustracion: -1 } },
        { type: 'hueco_libre', description: 'Sin reuniones las proximas 2 horas', mood: { alegria: 2, estres: 2 } },
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
      console.error('Error generando evento mock:', err);
      return null;
    }
  }
}

module.exports = MockIntegrations;
