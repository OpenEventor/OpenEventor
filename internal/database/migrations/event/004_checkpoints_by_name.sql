-- 004_checkpoints_by_name.sql — on iOS this converts any passings/courses that
-- still held checkpoint *ids* (from an interim id-based model) back to canonical
-- checkpoint *names*. The web platform has only ever stored checkpoint names in
-- courses.checkpoints and passings.checkpoint, so there is nothing to convert.
--
-- This file exists so the schema_migrations ledger matches iOS byte-for-byte,
-- which is what lets neither app re-run the other's migrations on a shared
-- event_<uuid>.db. It intentionally performs no data changes.
SELECT 1;
