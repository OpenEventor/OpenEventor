ALTER TABLE events ADD COLUMN token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_token ON events(token);
