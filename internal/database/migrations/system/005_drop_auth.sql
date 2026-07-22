-- Remove authentication entirely. OpenEventor is LAN-local timing software for
-- race admins — the network boundary IS the access boundary. No users, no
-- sessions, no per-event tokens.
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS event_access;
DROP TABLE IF EXISTS users;
DROP INDEX IF EXISTS idx_events_token;
ALTER TABLE events DROP COLUMN token;
