-- Incidentes con estado (la máquina rota, el olor del micro, los pósits por el suelo…) y eventos
-- de oficina (afterwork, talleres, team building, cumpleaños). Ver backend/src/world/incidents.js
-- y events.js. Un incidente dura hasta que se arregla: solo, alguien de la oficina o el técnico.

CREATE TABLE office_incidents (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    kind VARCHAR(40) NOT NULL,
    place VARCHAR(20) NOT NULL,
    cause_character INTEGER REFERENCES characters(id) ON DELETE SET NULL,
    started_day DATE NOT NULL,
    started_min INTEGER NOT NULL,
    -- Si se pasa solo (el olor, el apagón), cuándo.
    ends_day DATE,
    ends_min INTEGER,
    -- tiempo | alguien | tecnico
    repair VARCHAR(12) NOT NULL DEFAULT 'tiempo',
    resolved_day DATE,
    resolved_min INTEGER,
    resolved_by TEXT,
    data JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX office_incidents_open ON office_incidents (company_id) WHERE resolved_day IS NULL;

CREATE TABLE office_events (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    kind VARCHAR(30) NOT NULL,
    title VARCHAR(80) NOT NULL,
    place VARCHAR(20) NOT NULL,
    day DATE NOT NULL,
    from_min INTEGER NOT NULL,
    to_min INTEGER NOT NULL,
    -- auto: lo propuso la oficina (se puede borrar); si no, lo creó el admin.
    auto BOOLEAN NOT NULL DEFAULT FALSE,
    -- Para los automáticos borrados: no se vuelven a crear.
    cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, day, kind, from_min)
);
CREATE INDEX office_events_day ON office_events (company_id, day);
