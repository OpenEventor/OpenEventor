# OpenEventor Web — Parity Plan (web ← iOS)

**Goal.** Bring the Go/React web app to full functional parity with the native iOS app,
with a database schema that is **byte-identical across all OpenEventor projects** (iOS, web,
and where relevant legacy Laravel) so `.db` files interchange freely.

Source-of-truth for behaviour and model is now the **iOS app**
(`/Users/surzhikov/projects/openeventor3/ios/OpenEventorKit/Sources/`).
Web working copy: `/tmp/oe-web`.

---

## 1. Current state (codebase audit, 2026-07-04)

### 1.1 What web already has — reuse, don't rebuild
- **Auth**: JWT HS256 (15-min access + 7-day refresh sessions), bcrypt, default `admin/admin`. `internal/handlers/auth.go`.
- **Storage**: per-event `event_<uuid>.db` + `system.db`; WAL; embedded-SQL migration runner keyed by filename. `internal/database/`.
- **CRUD**: competitors, courses, groups, teams, passings, settings — all working.
- **Passings ingestion**: `POST /api/events/:id/passings` (batch JSON, event-token auth), centisecond rounding, no-FK card matching. `passings.go`.
- **SSE**: hub-per-event broker, `passing` + `competitor` events, heartbeat, drops slow clients. `internal/sse`.
- **Import**: XLSX (excelize) + CSV, 4 modes, EN/RU header auto-detect, 4-step ImportWizard. Already matches iOS import.
- **Live monitor**: SSE + LokiJS + virtualized rows + deltas + sound + play/pause. Excellent — but shows **raw splits only**.
- **Time components**: `TimeInput` (segmented `HH:mm:ss.cs` editor with scrub + day prefix, tz-aware), `Time`/`Delta`, tz utils. Reuse everywhere.
- **Competitor dialog** (view/edit/create) + **PassingsEditor** (batch add/edit, interpolation slider) = the manual-finish editing surface.

### 1.2 What's missing vs iOS — the work
Web has the **input** half; iOS additionally has the entire **compute + output** half.
- **Schema**: first-class `checkpoints` table, `passings.raw_code`, migrations 003/004.
- **Results/validation engine** (`internal/results` + `internal/validation` are interface-only; `/results` = 501).
- **Problem resolver** («Разбор проблем»).
- **Protocols generator** (start+results, PDF/print) — `ProtocolsPage` is a 14-line stub; `internal/reports` interface-only.
- **Localization ru/en** — no i18n at all; UI hardcoded English.
- **Export/backup** of raw `.db` — Download disabled, no WAL-checkpoint.
- **Checkpoints UI** — courses currently edited as a raw JSON string.
- **Competitor filter panel** (button is a no-op), **relational pickers** (group/course/team as raw-ID text fields), **group course-XOR-parent** enforcement.
- **Events import** (file upload + integrity + created/modified dates) — web only has "reload dir".
- **Thermal printouts** — absent (also only scaffolding in iOS).

---

## 2. Model unification (Task #1)

Core tables are **already byte-identical by design** (`competitors` 36 cols, `teams`, `groups`,
`courses`, `passings`, `files`, `checkins`, `payments`, `settings`). Only checkpoints diverge.

**Divergence:** iOS has a first-class `checkpoints` table (`id`, `name`, `latitude REAL?`,
`longitude REAL?`, `description`, `sort_order`, `created_at`, `updated_at` + `idx_checkpoints_name`)
and `passings.raw_code`; `courses.checkpoints` / `passings.checkpoint` reference the checkpoint
**name**. Web has neither table nor `raw_code`; it stores checkpoints as an inline JSON array of
code strings on `courses` (already names/codes, so semantically compatible).

**Steps**
1. Port `event/003_control_points.sql` (+ conversion): add `checkpoints` table + `idx_checkpoints_name`; add `passings.raw_code TEXT`; **materialize** a `checkpoints` row for every distinct name found in any `courses.checkpoints` JSON or `passings.checkpoint`.
2. Port `event/004_checkpoints_by_name.sql`: guarantee `courses.checkpoints` + `passings.checkpoint` hold canonical **names** (web already does → effectively a no-op that just records the migration so the ledger aligns).
3. **Interchange correctness (critical).** iOS auto-seeds 001+002 into `schema_migrations` and applies 003/004 in code, marking each applied by exact filename. Web's runner is filename-keyed too. Migration **filenames must match exactly** (`003_control_points.sql`, `004_checkpoints_by_name.sql`) so neither app re-runs the other's migrations on a shared file. Where iOS does data conversion in Swift, web must do the equivalent — the checkpoint materialization needs JSON parsing, so implement it as a **Go post-migration hook gated on the migration filename** (not pure SQL).
4. Go models: add `Checkpoint` struct; add `RawCode` to `Passing`.
5. Add checkpoints CRUD: `GET/POST/PUT/DELETE /api/events/:id/checkpoints`.
6. **Verify round-trip**: create event in web → open in iOS (and vice-versa) → identical schema + migration ledger, no re-migration, no data loss.

---

## 3. Frontend model catch-up (part of Task #2 + prep)
- **Checkpoints page**: CRUD + geo (lat/lon paste-parse, optional map). Mirror `CheckpointsView`.
- **Courses UI**: replace the raw-JSON checkpoints textbox with an ordered checkpoint-sequence builder (pick from checkpoints, repeat = lap, drag-reorder). Mirror `CoursesView`.
- **Group dialog**: enforce course **XOR** parent; show inherited course with an "↑" marker.
- **Competitor dialog**: replace raw-ID text fields with group/course/team **pickers**.
- **Competitor list**: build the real **filter panel** (group/course/team/status/check-in) + removable active-filter chips. Mirror the iOS filter sheet.

---

## 4. Results / validation engine — Go (keystone)

Port iOS `OpenEventorStore/Results.swift` + validators to Go `internal/results` + `internal/validation`:
- `CourseResolver`: group's inherited course (walk `parent_id` chain, cycle-safe) overrides competitor's own `course_id`.
- `StartResolver`: competitor → group → course → first punch → none (with source enum).
- Validators: `StrictValidator` (orienteering) + `RelaxedValidator` (ski), chosen by `course.validation_mode`; DNF-vs-DSQ decided by reaching the **last checkpoint by position**.
- Status derivation: computed course status, then manual flags override **DSQ > DNF > DNS**; DNF/DNS zero the total; `time_adjustment` added only to an OK finish.
- Ranking: per resolved course, OK & in-rank by ascending total. Competition ranking (1-2-2-4) + points + gaps live in the protocol layer.
- Splits/legs + deltas.
- **Expose**: implement `GET /api/events/:id/results` (filters course/group); optionally emit `result` SSE events. This becomes the **single source of truth** for the monitor's "troubles", protocols, and external API consumers (the platform's hub vision).

---

## 5. Monitor refactor (Task #2 completion)
- Wire the monitor to computed results: real status (OK/DSQ/DNF/DNS by missing checkpoints), **places**, and the real **"with troubles"** count (currently hardcoded `0`, `useMonitorStore.ts:350`).
- Resolve checkpoint names via the checkpoints table.
- Keep the existing SSE/LokiJS/virtualization UX; add a computed-status layer over it.

---

## 6. Problem resolver «Разбор проблем» (port)
Port `Problems.swift` `ProblemScanner` to Go: 14 kinds (event no-date/place/courses, empty/dup
course, dup group, group course+parent, card collision, unknown-card punches, dup bib,
competitor no-course/no-card/negative-time/broken-order), severity info/warning/critical.
`GET /api/events/:id/problems`; a Problems page with a severity filter + counts; rows navigate to
the fix surface (competitor/course/group/settings editor). Feeds the monitor "troubles" count.

---

## 7. Protocols generator (port)
Port `ProtocolBuilder.swift`: start + results protocols; group **or** course grouping (parent pulls
the whole subtree); ~13 column toggles persisted per-event as `protocol_*` settings; competition
ranking 1-2-2-4; points-DESC; gap-to-leader/prev. Render **HTML → print/PDF client-side** (matches
CLAUDE.md "PDF client-side" + iOS's HTML approach): print stylesheet + `window.print()`, optional
jsPDF/paged.js for file export. Protocols page: type, grouping, multi-select sections, column
settings panel (reuse `useColumnSettings`), preview, print/export.

---

## 8. Localization ru/en (port)
Add **react-i18next**. Extract hardcoded strings; ru source + en (mirror iOS's 419-key catalog).
Language follows browser + a manual switch (web can afford the toggle iOS deliberately lacks).

---

## 9. Export / backup + events import (port)
- **Export**: `GET /api/events/:id/export` → WAL-checkpoint (TRUNCATE) → stream the `.db` (stamp `settings['backup']`). Enable the Download button. Mirror `ExportBackupView`.
- **Events import**: file-upload import with an integrity check (SQLite header + required tables + migrations + `oe_format` marker + id-collision "replace / keep both"), mirroring `EventWorkspace`; created/modified-date columns; a "..." Create/Import menu.

---

## 10. Thermal printouts — lowest priority
Parity note: iOS has only ESC/POS scaffolding (a test page), no finish-slip printing, no tape-width
catalog. So "parity" here = **also-absent**. Defer until iOS builds it; keep a placeholder.

---

## 11. Recommended sequencing
Dependency-ordered (differs slightly from the literal 1-2-3 because the monitor refactor depends on
the results engine existing):
1. **Model unification** (§2) — unblocks interchange + checkpoints everywhere.
2. **Frontend model catch-up** (§3) — checkpoints/courses UI, pickers, filters.
3. **Results/validation engine** (§4) — the keystone; unblocks monitor, problems, protocols.
4. **Monitor refactor** (§5) — wire to results.
5. **Problem resolver** (§6).
6. **Protocols** (§7).
7. **Localization** (§8).
8. **Export/backup + events import** (§9).
9. **Thermal printouts** (§10) — deferred.

---

## 12. Open decisions
- **Engine location**: Go backend single-source (recommended — serves API consumers) vs client-side TS (mirrors iOS, fastest monitor) vs both.
- **Monitor refactor scope**: wire-to-results (recommended) vs structural rework vs both.
- **Information architecture**: keep web's tabbed `EventLayout` + add missing sections (recommended, web-idiomatic) vs reshape to the iOS 4-block hub.
- **Assumed defaults**: PDF/print client-side; i18n via react-i18next; checkpoints promoted to a first-class table.
