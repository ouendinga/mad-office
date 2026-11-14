-- Ajustes de la instalación (p. ej. el hash de la contraseña de la puerta).
CREATE TABLE settings (
    key VARCHAR(60) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
