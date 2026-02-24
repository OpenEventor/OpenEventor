CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    bib TEXT,
    card_number TEXT,
    first_name TEXT,
    last_name TEXT,
    birth_date TEXT,
    gender TEXT,
    team_id TEXT,
    group_id TEXT,
    course_id TEXT,
    dsq INTEGER DEFAULT 0,
    dsq_description TEXT,
    dns INTEGER DEFAULT 0,
    dnf INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS age_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    course_id TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    checkpoints TEXT NOT NULL,
    validation_mode TEXT DEFAULT 'strict',
    description TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS punches (
    id TEXT PRIMARY KEY,
    card_number TEXT NOT NULL,
    checkpoint TEXT NOT NULL,
    timestamp_utc TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    source TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    purpose TEXT,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_punches_card ON punches(card_number);
CREATE INDEX IF NOT EXISTS idx_punches_checkpoint ON punches(checkpoint);
CREATE INDEX IF NOT EXISTS idx_participants_card ON participants(card_number);
CREATE INDEX IF NOT EXISTS idx_participants_group ON participants(group_id);
CREATE INDEX IF NOT EXISTS idx_participants_course ON participants(course_id);
CREATE INDEX IF NOT EXISTS idx_age_groups_course ON age_groups(course_id);
