-- Oficina viva v2: estados 0-5, teletrabajo y trayectos por día, y feed con sitio y hora para
-- saber quién oye qué. Ver doc/oficina-viva.md («Oficina viva v2»).

ALTER TABLE characters
    ADD COLUMN stats JSONB NOT NULL
        DEFAULT '{"energia":4,"animo":3.5,"saciedad":3.5,"social":3,"calma":3.5}';

-- Cómo es el día de cada personaje: dónde trabaja y qué le pasó por el camino.
CREATE TABLE day_status (
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    mode VARCHAR(10) NOT NULL CHECK (mode IN ('oficina', 'remoto')),
    ida TEXT,
    vuelta TEXT,
    extra BOOLEAN NOT NULL DEFAULT FALSE, -- horas extra: se queda hasta las 20:00
    PRIMARY KEY (character_id, day)
);

ALTER TABLE feed
    ADD COLUMN lugar VARCHAR(20),
    ADD COLUMN con_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
    ADD COLUMN externo VARCHAR(80),
    ADD COLUMN min INTEGER,
    ADD COLUMN private BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX feed_by_character ON feed (character_id, id DESC);
CREATE INDEX feed_by_con ON feed (con_id, id DESC);
CREATE INDEX feed_by_day ON feed (office_day, min);
