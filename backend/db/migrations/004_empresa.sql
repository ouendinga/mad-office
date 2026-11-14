-- Varias empresas por instalación. Cada una con su oficina (ciudad, horario), su organigrama en
-- árbol, sus personajes (uno distinto por persona y empresa), su feed, su carga de trabajo, sus
-- invitaciones y sus peticiones para entrar. Ver doc/oficina-viva.md («Empresas»).
-- El organigrama de partida y sus ficticios se siembran desde el código (src/company/template.js).

CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(60) NOT NULL,
    visibility VARCHAR(8) NOT NULL DEFAULT 'privada' CHECK (visibility IN ('publica', 'privada')),
    -- hours, location, remotePerWeek, officeDays, jobBoard…
    settings JSONB NOT NULL DEFAULT '{}',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE memberships (
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(8) NOT NULL DEFAULT 'miembro' CHECK (role IN ('admin', 'miembro')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, user_id)
);

-- Enlaces de invitación: un código aleatorio, con caducidad y número de usos.
CREATE TABLE invitations (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(40) NOT NULL UNIQUE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 10,
    uses INTEGER NOT NULL DEFAULT 0,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cargos. Un cargo no necesita que el de encima esté ocupado. «is_unique»: solo una persona
-- (CEO…). «seats»: cuántos ficticios lo ocupan si no hay nadie de verdad. «place»: dónde se sienta.
-- «ad»: la oferta de broma del tablón «Se busca personal» (la escribe la IA una vez).
CREATE TABLE positions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES positions(id) ON DELETE SET NULL,
    title VARCHAR(60) NOT NULL,
    csuite BOOLEAN NOT NULL DEFAULT FALSE,
    is_unique BOOLEAN NOT NULL DEFAULT TRUE,
    seats INTEGER NOT NULL DEFAULT 1 CHECK (seats BETWEEN 0 AND 10),
    place VARCHAR(12) NOT NULL DEFAULT 'mesa' CHECK (place IN ('mesa', 'despacho', 'recepcion')),
    sort INTEGER NOT NULL DEFAULT 0,
    ad JSONB
);
CREATE INDEX positions_company ON positions (company_id);

-- Pedir entrar a una empresa pública (opcionalmente a un cargo concreto).
CREATE TABLE join_requests (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL,
    message VARCHAR(280),
    status VARCHAR(10) NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aceptada', 'rechazada')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX one_pending_join ON join_requests (company_id, user_id) WHERE status = 'pendiente';

-- Personajes: uno por persona Y empresa. npc_seat: ficticio que ocupa un hueco; retired: se ha
-- ido porque ha entrado una persona de verdad en su cargo (vuelve si esa persona se va).
ALTER TABLE characters DROP CONSTRAINT characters_owner_user_id_key;
ALTER TABLE characters
    ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    ADD COLUMN position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL,
    ADD COLUMN npc_seat BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN retired BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX one_character_per_company ON characters (company_id, owner_user_id) WHERE owner_user_id IS NOT NULL;

ALTER TABLE feed ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX feed_company ON feed (company_id, id DESC);

-- Carga de trabajo por empresa y día: 0 tranquila, 1 normal, 2 alta, 3 a tope. Sin fila = normal.
-- La marca solo el admin (decisión de Álvaro, 2026-11-14).
CREATE TABLE workload (
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    level SMALLINT NOT NULL CHECK (level BETWEEN 0 AND 3),
    note VARCHAR(140),
    PRIMARY KEY (company_id, day)
);

-- Pedirle un cargo único a quien lo tiene: si acepta, se intercambian.
CREATE TABLE position_requests (
    id SERIAL PRIMARY KEY,
    from_character INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    to_character INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    status VARCHAR(10) NOT NULL DEFAULT 'pendiente'
        CHECK (status IN ('pendiente', 'aceptada', 'rechazada', 'anulada')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX one_pending_request ON position_requests (from_character, position_id) WHERE status = 'pendiente';

-- Lo que ya existía pasa a ser la empresa 1, con la ciudad y el horario que hubiera guardados.
INSERT INTO companies (id, name, visibility, settings, created_by)
SELECT 1, 'Mad Office', 'privada',
       jsonb_strip_nulls(jsonb_build_object(
         'location', (SELECT value::jsonb FROM settings WHERE key = 'office_location'),
         'hours', (SELECT value::jsonb FROM settings WHERE key = 'office_hours'))),
       (SELECT id FROM users WHERE is_admin ORDER BY id LIMIT 1);
SELECT setval('companies_id_seq', 1);
INSERT INTO memberships (company_id, user_id, role)
SELECT 1, id, CASE WHEN is_admin THEN 'admin' ELSE 'miembro' END FROM users;
UPDATE characters SET company_id = 1;
UPDATE feed SET company_id = 1;
UPDATE characters SET npc_seat = TRUE WHERE owner_user_id IS NULL;
ALTER TABLE characters ALTER COLUMN company_id SET NOT NULL;
DELETE FROM settings WHERE key IN ('office_location', 'office_hours');
