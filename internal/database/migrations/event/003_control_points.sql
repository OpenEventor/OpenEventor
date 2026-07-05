-- 003_control_points.sql — control points become a first-class `checkpoints`
-- entity; passings gain a `raw_code` audit column.
--
-- Byte-compatible (table shape + filename) with the iOS OpenEventorStore so that
-- event_<uuid>.db files interchange between the web and mobile apps. The
-- raw_code column and the materialization of checkpoint rows from existing
-- checkpoint names are handled by the Go post-migration hook
-- `materializeCheckpoints` (internal/database/checkpoints_migration.go), because
-- they need a guarded ADD COLUMN and JSON parsing that plain SQL can't express
-- idempotently.

CREATE TABLE IF NOT EXISTS checkpoints (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_name ON checkpoints(name);
