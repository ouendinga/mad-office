-- Tramas: historias que se encadenan por reglas (world/tramas.js), y lo que se tienen unos a otros
-- (roce y aprecio, dirigidos: lo que a siente por b), que cambia con lo que pasa y se olvida poco a poco.

CREATE TABLE office_plots (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    kind VARCHAR(30) NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    -- rol -> id de personaje
    cast_ids JSONB NOT NULL DEFAULT '{}',
    state JSONB NOT NULL DEFAULT '{}',
    step VARCHAR(30) NOT NULL,
    waits INTEGER NOT NULL DEFAULT 0,
    next_day DATE NOT NULL,
    next_min INTEGER NOT NULL,
    -- 'sola' | 'incidente:<kind>' | 'trama:<kind>' | 'pruebas'
    origin VARCHAR(40) NOT NULL DEFAULT 'sola',
    started_day DATE NOT NULL,
    ended_day DATE,
    outcome VARCHAR(30)
);
CREATE INDEX office_plots_open ON office_plots (company_id) WHERE ended_day IS NULL;

CREATE TABLE relations (
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    a INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    b INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    roce REAL NOT NULL DEFAULT 0,
    aprecio REAL NOT NULL DEFAULT 0,
    day DATE NOT NULL,
    PRIMARY KEY (company_id, a, b)
);
