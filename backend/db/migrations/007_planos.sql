-- Oficinas dibujadas por cada empresa con el diseñador (las plantillas van en backend/src/layouts).
-- data: el plano (rejilla, salas, muebles); lo demás (mesas, huecos, aforos) sale de él al cargarlo
-- (world/layout.js, derive). Se usan con una mudanza a 'p<id>'.
CREATE TABLE office_plans (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(60) NOT NULL,
    data JSONB NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX office_plans_company ON office_plans (company_id);
