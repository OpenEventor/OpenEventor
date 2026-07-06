-- Timing systems: global (cross-event) instances that receive punches from
-- external timing hardware and route them into a chosen event's database.
--
-- Each row is one INSTANCE. You may add several of the same kind (e.g. three
-- OSTIS configs for three stadiums), but the receive URL is FIXED per kind
-- (/api/timing/ostis, /api/timing/universal) — no per-instance token — so at
-- most one instance per kind may be active (`enabled = 1`) at a time; that
-- active one is where punches for its kind are routed. The single-active-per-kind
-- invariant is enforced by the API (enabling one disables its siblings).
CREATE TABLE IF NOT EXISTS timing_systems (
    id         TEXT PRIMARY KEY,
    kind       TEXT NOT NULL,                 -- 'universal' | 'ostis'
    name       TEXT NOT NULL,
    event_id   TEXT,                          -- target event ("" / NULL = not routed yet)
    enabled    INTEGER NOT NULL DEFAULT 0,    -- 1 = the active instance of its kind
    rules      TEXT NOT NULL DEFAULT '[]',    -- JSON: [{rawId,name,timeAdjustment}]
    created_at TEXT NOT NULL
);
