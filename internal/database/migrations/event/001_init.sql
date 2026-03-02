CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS competitors (
    id TEXT PRIMARY KEY,
    bib TEXT,
    card1 TEXT,
    card2 TEXT,
    team_id TEXT,
    group_id TEXT,
    course_id TEXT,

    first_name TEXT,
    last_name TEXT,
    middle_name TEXT,
    first_name_int TEXT,
    last_name_int TEXT,
    gender TEXT,
    birth_date TEXT,
    birth_year INTEGER,

    rank TEXT,
    rating REAL,

    country TEXT,
    region TEXT,
    city TEXT,

    phone TEXT,
    email TEXT,

    start_time TEXT,
    time_adjustment INTEGER DEFAULT 0,

    dsq INTEGER DEFAULT 0,
    dsq_description TEXT,
    dns INTEGER DEFAULT 0,
    dnf INTEGER DEFAULT 0,
    out_of_rank INTEGER DEFAULT 0,

    entry_number TEXT,
    price REAL,
    is_paid INTEGER DEFAULT 0,
    is_checkin INTEGER DEFAULT 0,

    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT,
    region TEXT,
    city TEXT,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    course_id TEXT,
    parent_id TEXT,
    gender TEXT,
    year_from INTEGER,
    year_to INTEGER,
    start_time TEXT,
    price REAL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    checkpoints TEXT NOT NULL,
    validation_mode TEXT DEFAULT 'strict',
    geo_track TEXT,
    length REAL,
    altitude REAL,
    climb REAL,
    start_time TEXT,
    price REAL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS passings (
    id TEXT PRIMARY KEY,
    card TEXT NOT NULL,
    checkpoint TEXT NOT NULL,
    timestamp REAL NOT NULL DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    source TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    purpose TEXT,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    competitor_id TEXT NOT NULL,
    user_id TEXT,
    status INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    competitor_id TEXT NOT NULL,
    user_id TEXT,
    amount REAL NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checkins_competitor ON checkins(competitor_id);
CREATE INDEX IF NOT EXISTS idx_payments_competitor ON payments(competitor_id);
CREATE INDEX IF NOT EXISTS idx_passings_card ON passings(card);
CREATE INDEX IF NOT EXISTS idx_passings_checkpoint ON passings(checkpoint);
CREATE INDEX IF NOT EXISTS idx_competitors_card1 ON competitors(card1);
CREATE INDEX IF NOT EXISTS idx_competitors_card2 ON competitors(card2);
CREATE INDEX IF NOT EXISTS idx_competitors_group ON competitors(group_id);
CREATE INDEX IF NOT EXISTS idx_competitors_course ON competitors(course_id);
CREATE INDEX IF NOT EXISTS idx_groups_course ON groups(course_id);
