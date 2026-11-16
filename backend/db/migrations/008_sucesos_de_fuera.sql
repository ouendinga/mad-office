-- Sucesos de FUERA (la nevada, la final del fútbol, la huelga, la inspección…): como mucho uno al
-- día por empresa, tirado por reglas (backend/src/world/outside.js). Se guarda para que un reinicio
-- no lo vuelva a tirar con otro tiempo. kind = 'nada' apunta que hoy ya se tiró y no salió nada.

CREATE TABLE office_outside (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    kind VARCHAR(30) NOT NULL,
    -- Franja en la que se nota (la tele, la guerra de bolas, la inspección), en minutos del día.
    from_min INTEGER,
    to_min INTEGER,
    -- Provocado desde el modo pruebas.
    forced BOOLEAN NOT NULL DEFAULT FALSE,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, day, kind)
);
CREATE INDEX office_outside_day ON office_outside (company_id, day);
