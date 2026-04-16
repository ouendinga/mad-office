-- Mad Office Database Schema v2
-- Sistema bipolar de estados de animo

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_config JSONB DEFAULT '{}',
    desk_index INTEGER,
    position_x FLOAT DEFAULT NULL,
    position_y FLOAT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mood_states (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    alegria INTEGER DEFAULT 5 CHECK (alegria >= 0 AND alegria <= 10),
    energia INTEGER DEFAULT 5 CHECK (energia >= 0 AND energia <= 10),
    optimismo INTEGER DEFAULT 5 CHECK (optimismo >= 0 AND optimismo <= 10),
    frustracion INTEGER DEFAULT 5 CHECK (frustracion >= 0 AND frustracion <= 10),
    estres INTEGER DEFAULT 5 CHECK (estres >= 0 AND estres <= 10),
    current_action VARCHAR(50) DEFAULT 'sentado',
    current_representation VARCHAR(50) DEFAULT NULL,
    action_started_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mock_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    source VARCHAR(50) NOT NULL,
    description TEXT,
    mood_impact JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS office_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    description TEXT,
    mood_impact JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default users
INSERT INTO users (email, name, desk_index) VALUES
    ('david@madoffice.com', 'David', 0),
    ('alfredo@madoffice.com', 'Alfredo', 1),
    ('jose.antonio@madoffice.com', 'Jose Antonio', 2),
    ('jose.luis@madoffice.com', 'Jose Luis', 3),
    ('carlos@madoffice.com', 'Carlos', 4)
ON CONFLICT (email) DO NOTHING;

-- Insert default mood states (all at neutral 5)
INSERT INTO mood_states (user_id, alegria, energia, optimismo, frustracion, estres)
SELECT id, 5, 5, 5, 5, 5 FROM users
ON CONFLICT DO NOTHING;
