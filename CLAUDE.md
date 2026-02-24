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

The system uses a **hub architecture**: OpenEventor is a data platform that receives punches (timing marks) via API from external sources and serves results to external consumers via API/SSE.

```
Data Producers → OpenEventor API → Data Consumers

SPORTident app  →                → Video overlay
SFR app         →  punches API   → LED scoreboard
Mobile timer    →  + SSE stream  → Online results
Manual input    →                → Telegram bot
```

OpenEventor does NOT include hardware drivers. Timing system integrations are separate open-source utilities.

## Database Architecture

- **system.db** — users, events registry, access control
- **event_<uuid>.db** — all event data (participants, punches, courses, etc.)

Each event DB is fully self-contained (including file attachments as BLOBs). Copying one .db file = copying the entire event.

Results are ALWAYS computed on the fly from punches + courses. Never stored.

## Key Entities (per event DB)

- `participants` — card_number (text), bib, name, group_id, course_id, dsq/dns flags
- `teams`
- `age_groups` — optional link to course
- `courses` — ordered checkpoint list + validation algorithm
- `punches` — card_number (text), checkpoint (text), timestamp_utc, enabled
- `files` — name, mime_type, purpose, data (BLOB)
- `settings` — key/value store for event metadata

## Critical Design Principles

1. **Data preservation over schema integrity.** Punches are stored regardless of whether the participant or checkpoint exists. No foreign key constraints between punches and participants — they are linked by card_number as plain text.
2. **card_number is not a strict FK.** Participants may not exist yet when punches arrive. Chips may be reassigned (prefix with 1000). The system must handle orphaned punches gracefully.
3. **checkpoint names in punches are plain text.** A punch may reference a checkpoint that doesn't exist in the course definition. This is expected and must not cause errors.
4. **Results are always computed, never cached.** Protocol generation reads punches + course definition and calculates everything on the fly.
5. **Statuses (DNS/DNF/DSQ) can be both stored and computed.** Manual DSQ is a participant field. Course validation DSQ is computed during result generation.
6. **Laps and splits are the same abstraction.** A ski race with 3 laps: course = [LAP, LAP, FINISH].

## API Design

- `POST /api/auth/login|refresh|logout`
- `GET/POST /api/events` — event management (system.db)
- `/api/events/:id/*` — all operations within an event DB
- `POST /api/events/:id/punches` — accepts batch writes, uses event-token (not user JWT)
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

## Commands

- `go run ./cmd/server` — start backend
- `cd frontend && npm run dev` — start frontend dev server
- `go test ./...` — run all backend tests
