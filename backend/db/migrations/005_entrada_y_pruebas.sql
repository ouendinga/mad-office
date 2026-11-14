-- Entrada sin la contraseña común (como en Preventa): quien llega con un enlace de invitación se
-- pone SU contraseña al crear la cuenta, y con ella vuelve a entrar desde cualquier sitio.
-- Solo se guarda el hash (scrypt).
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Modo pruebas del dueño: jugadores de prueba (cuentas inventadas que maneja él) y personajes que
-- no gastan IA aunque sean de una persona (van en piloto automático).
ALTER TABLE users ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE characters ADD COLUMN sin_ia BOOLEAN NOT NULL DEFAULT FALSE;
