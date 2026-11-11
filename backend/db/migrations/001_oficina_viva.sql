-- Oficina viva: personajes autónomos, planes por bloque, diarios, sueños y turnos de IA.
-- Ver doc/oficina-viva.md.

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(80) NOT NULL,
    avatar_config JSONB NOT NULL DEFAULT '{}',
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un personaje por persona; los que no tienen dueño son compañeros ficticios (los paga el admin).
CREATE TABLE characters (
    id SERIAL PRIMARY KEY,
    owner_user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    avatar_config JSONB NOT NULL DEFAULT '{}',
    desk_index INTEGER NOT NULL,
    ficha JSONB NOT NULL DEFAULT '{}',
    interview JSONB NOT NULL DEFAULT '{}',
    approved BOOLEAN NOT NULL DEFAULT FALSE,
    paused BOOLEAN NOT NULL DEFAULT FALSE,
    model VARCHAR(20) NOT NULL DEFAULT 'haiku' CHECK (model IN ('haiku', 'sonnet')),
    energia INTEGER NOT NULL DEFAULT 8 CHECK (energia BETWEEN 0 AND 10),
    cafe INTEGER NOT NULL DEFAULT 5 CHECK (cafe BETWEEN 0 AND 10),
    humor VARCHAR(20) NOT NULL DEFAULT 'normal',
    profile_attempts_day DATE,
    profile_attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Plan de un bloque (mañana/tarde). source: 'autopiloto' o 'ia'.
CREATE TABLE plans (
    id SERIAL PRIMARY KEY,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    block VARCHAR(10) NOT NULL CHECK (block IN ('manana', 'tarde')),
    source VARCHAR(12) NOT NULL,
    actions JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (character_id, day, block)
);

CREATE TABLE diaries (
    id SERIAL PRIMARY KEY,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (character_id, day)
);

-- morning = la mañana laborable en la que el personaje despierta con ese sueño.
CREATE TABLE dreams (
    id SERIAL PRIMARY KEY,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    morning DATE NOT NULL,
    text VARCHAR(200) NOT NULL,
    followed BOOLEAN,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (character_id, morning)
);

CREATE TABLE feed (
    id SERIAL PRIMARY KEY,
    character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL,
    text TEXT NOT NULL,
    office_day DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX feed_recent ON feed (id DESC);

-- Cola de trabajo para la IA. La resuelve el despertador (u otro conector).
CREATE TABLE turns (
    id SERIAL PRIMARY KEY,
    character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
    payer_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL,
    office_day DATE NOT NULL,
    block VARCHAR(10),
    model VARCHAR(20) NOT NULL,
    request JSONB NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'done', 'failed', 'expired')),
    attempts INTEGER NOT NULL DEFAULT 0,
    result JSONB,
    error TEXT,
    cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);
CREATE INDEX turns_queue ON turns (status, id);
-- Un solo turno vivo por personaje, día y tipo de bloque (evita duplicar gasto).
CREATE UNIQUE INDEX turns_one_per_block ON turns (character_id, office_day, kind)
    WHERE kind IN ('despertar', 'tarde', 'diario') AND status IN ('queued', 'running', 'done');

-- Compañeros ficticios para que la oficina no esté vacía.
INSERT INTO characters (name, desk_index, approved, avatar_config, ficha) VALUES
('Marisa', 1, TRUE, '{"skinTone":1,"hairStyle":2,"hairColor":3,"clothes":2,"accessory":1}',
 '{"puesto":"Jefa de proyecto","personalidad":"Organizadísima, convoca reuniones para decidir cuándo hacer la siguiente reunión. Optimista profesional.","manias":["Post-its de seis colores con código propio","Dice \"esto lo hablamos offline\" en persona","Escribe actas de las conversaciones del café"],"objetivo":"Que alguien, una sola vez, lea sus actas","muletillas":["Lo apunto.","¿Lo bajamos a tierra?","Esto da para una reunión.","Te mando invitación.","Sincronizamos luego.","Alineemos expectativas."]}'),
('Paco', 2, TRUE, '{"skinTone":2,"hairStyle":4,"hairColor":5,"clothes":3,"accessory":2}',
 '{"puesto":"Sysadmin veterano","personalidad":"Gruñón de corazón tierno. Desconfía de todo lo que se haya inventado después de 2009.","manias":["Nadie toca su taza de \"Keep calm and reboot\"","Todo era mejor en Perl","Apunta las contraseñas en un papel que esconde en una maceta"],"objetivo":"Un viernes entero sin incidencias","muletillas":["¿Has probado a reiniciarlo?","En mis tiempos...","Esto no es cosa mía.","Funciona en mi máquina.","Ya lo decía yo.","Café. Ahora."]}'),
('Lucía', 5, TRUE, '{"skinTone":0,"hairStyle":1,"hairColor":2,"clothes":1,"accessory":3}',
 '{"puesto":"Diseñadora UX","personalidad":"Perfeccionista y teatral; sufre físicamente ante una fuente mal elegida.","manias":["Mueve todo un píxel a la izquierda","Odia la Comic Sans con pasión","Hace tests de usabilidad con las plantas"],"objetivo":"Que le hagan caso con el botón azul","muletillas":["Ese margen me duele.","¿Y si lo probamos con usuarios?","Menos es más.","¡Ese naranja no!","Hagamos un boceto.","El usuario no lee."]}'),
('Toni', 6, TRUE, '{"skinTone":3,"hairStyle":3,"hairColor":0,"clothes":4,"accessory":0}',
 '{"puesto":"Becario","personalidad":"Entusiasmo sin límites y cero filtro. Cree que todo se arregla con IA.","manias":["Propone meter IA en la cafetera","Pide feedback cada diez minutos","Lleva una libreta de \"ideas de startup\""],"objetivo":"Que le contraten antes de que acabe la beca","muletillas":["¡Eso con IA se hace solo!","¿Puedo ayudar?","Lo he visto en un TikTok.","¡Qué guay!","Me lo apunto en la libreta.","¿Esto me lo evaluáis?"]}');
