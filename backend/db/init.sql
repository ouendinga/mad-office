-- Mad Office Database Schema

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_config JSONB DEFAULT '{}',
    desk_index INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mood_states (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    happiness INTEGER DEFAULT 5 CHECK (happiness >= 0 AND happiness <= 10),
    stress INTEGER DEFAULT 3 CHECK (stress >= 0 AND stress <= 10),
    frustration INTEGER DEFAULT 0 CHECK (frustration >= 0 AND frustration <= 10),
    excitement INTEGER DEFAULT 5 CHECK (excitement >= 0 AND excitement <= 10),
    sadness INTEGER DEFAULT 0 CHECK (sadness >= 0 AND sadness <= 10),
    tiredness INTEGER DEFAULT 3 CHECK (tiredness >= 0 AND tiredness <= 10),
    current_action VARCHAR(50) DEFAULT 'sitting',
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

-- Insert default users
INSERT INTO users (email, name, desk_index) VALUES
    ('david@madoffice.com', 'David', 0),
    ('alfredo@madoffice.com', 'Alfredo', 1),
    ('jose.antonio@madoffice.com', 'Jose Antonio', 2),
    ('jose.luis@madoffice.com', 'Jose Luis', 3),
    ('carlos@madoffice.com', 'Carlos', 4)
ON CONFLICT (email) DO NOTHING;

-- Insert default mood states for each user
INSERT INTO mood_states (user_id, happiness, stress, frustration, excitement, sadness, tiredness)
SELECT id, 5, 3, 0, 5, 0, 3 FROM users
ON CONFLICT DO NOTHING;
