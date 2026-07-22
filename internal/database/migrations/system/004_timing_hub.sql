-- OpenEventor HUB timing kind: unlike push kinds (ostis/universal) the server
-- PULLS a resumable punch stream from the hub (a utility inside an OpenWRT
-- router) via long-poll /v1/stream. The pull cursor (session + seq) is persisted
-- here so a server restart resumes loss-free instead of re-ingesting from 0.
ALTER TABLE timing_systems ADD COLUMN hub_url     TEXT    NOT NULL DEFAULT '';
ALTER TABLE timing_systems ADD COLUMN hub_session TEXT    NOT NULL DEFAULT '';
ALTER TABLE timing_systems ADD COLUMN hub_cursor  INTEGER NOT NULL DEFAULT 0;
