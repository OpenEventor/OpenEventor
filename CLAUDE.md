# OpenEventor

Open-source timing and results platform for sports events (orienteering, skiing, running, multisport).

## Tech Stack

- **Backend:** Go (Fiber framework)
- **Frontend:** React + MUI (Material UI)
- **Database:** SQLite (one DB per event + one system DB)
- **Auth:** JWT (bcrypt for passwords)
- **PDF export:** Client-side (browser)
- **Excel:** excelize library (Go) for xlsx import/export

## Architecture Overview

See @docs/architecture.md for full details.

The system uses a **hub architecture**: OpenEventor is a data platform that receives passings (timing data) via API from external sources and serves results to external consumers via API/SSE.

```
Data Producers → OpenEventor API → Data Consumers

SPORTident app  →                → Video overlay
SFR app         →  passings API  → LED scoreboard
Mobile timer    →  + SSE stream  → Online results
Manual input    →                → Telegram bot
```

OpenEventor does NOT include hardware drivers. Timing system integrations are separate open-source utilities.

## Database Architecture

- **system.db** — users, events registry, access control
- **event_<uuid>.db** — all event data (competitors, passings, courses, etc.)

Each event DB is fully self-contained (including file attachments as BLOBs). Copying one .db file = copying the entire event.

Results are ALWAYS computed on the fly from passings + courses. Never stored.

## Key Entities (per event DB)

- `competitors` — card1/card2 (text, two chip slots), bib, name, group_id, course_id, rank, gender, birth_date/birth_year, country/region/city, phone/email, start_time, time_adjustment, dsq/dns/dnf/out_of_rank flags, entry_number/price/is_paid/is_checkin
- `teams` — name, country/region/city
- `groups` — course_id, parent_id (hierarchical), gender, year_from/year_to, start_time, price
- `courses` — ordered checkpoint list, validation algorithm, geo_track (GeoJSON), length/altitude/climb, start_time, price
- `passings` — card (text), checkpoint (text), timestamp (REAL, unix seconds with 2 decimal places), enabled
- `checkins` — audit log: competitor_id, user_id, status (1/0), created_at
- `payments` — audit log: competitor_id, user_id, amount (±), created_at
- `files` — name, mime_type, purpose, data (BLOB)
- `settings` — key/value store for event metadata

## Critical Design Principles

1. **Data preservation over schema integrity.** Passings are stored regardless of whether the competitor or checkpoint exists. No foreign key constraints between passings and competitors — they are linked by `card` as plain text.
2. **`card` is not a strict FK.** Competitors may not exist yet when passings arrive. Chips may be reassigned (prefix with 1000). The system must handle orphaned passings gracefully.
3. **checkpoint names in passings are plain text.** A passing may reference a checkpoint that doesn't exist in the course definition. This is expected and must not cause errors.
4. **Results are always computed, never cached.** Protocol generation reads passings + course definition and calculates everything on the fly.
5. **Statuses (DNS/DNF/DSQ) can be both stored and computed.** Manual DSQ is a competitor field. Course validation DSQ is computed during result generation.
6. **Laps and splits are the same abstraction.** A ski race with 3 laps: course = [LAP, LAP, FINISH].

## API Design

- `POST /api/auth/login|refresh|logout`
- `GET/POST /api/events` — event management (system.db)
- `/api/events/:id/*` — all operations within an event DB
- `POST /api/events/:id/passings` — accepts batch writes, uses event-token (not user JWT)
- `GET /api/events/:id/stream` — SSE for real-time consumers (scoreboards, overlays)
- `GET /api/events/:id/results` — computed results with filters (by course, group)

## Module Structure

No plugin system. Use Go interfaces for extensibility:

```
internal/
  reports/       # ReportRenderer interface — different output formats
  validation/    # CourseValidator interface — different validation algorithms
  importers/     # DataImporter interface — xlsx, csv parsers
```

New format or validation algorithm = new file implementing the interface + one line in registry. See docs/how-to-add-report.md for contributor guide.

## Code Conventions

- Go: standard project layout, `internal/` for private packages
- Error handling: always wrap errors with context, never ignore
- Naming: English everywhere (code, comments, commits, docs)
- API responses: JSON, camelCase keys
- Database: snake_case for columns and tables
- Timestamps: always UTC in database, convert to local only in UI
- File size limit for BLOB storage: 2MB per file

## Build & Deploy

The frontend is embedded into the Go binary via `//go:embed` (`static.go` at project root). After `make build`, the output is a single self-contained binary in `dist/`.

- `make build` — build for macOS (frontend + backend)
- `make build-windows` — cross-compile for Windows (requires `brew install mingw-w64`)
- `make build-linux-arm64` — cross-compile for Raspberry Pi (requires `brew install messense/macos-cross-toolchains/aarch64-unknown-linux-gnu`)
- `make build-all` — all platforms
- `make clean` — remove `dist/`

The binary opens browser automatically on startup. Use `--no-browser` flag to disable (server/headless deployments).

## Commands (Development)

- `go run ./cmd/server` — start backend (without embedded frontend)
- `cd frontend && npm run dev` — start frontend dev server (Vite, proxied to backend)
- `go test ./...` — run all backend tests
