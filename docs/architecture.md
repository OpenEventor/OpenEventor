# OpenEventor Architecture

## System Overview

OpenEventor is a timing and results platform for sports events. It serves as a central data hub: receiving timing data (punches) from external devices via API, computing results on the fly, and distributing them to consumers (scoreboards, video overlays, online results).

The system can be deployed locally (laptop in a timing tent, intranet) or in the cloud (shared service for multiple organizers).

## Deployment Modes

### Local (Timing Tent)
- Single Go binary + SQLite files on a laptop
- 1-5 users on local network
- WiFi may be shared with event participants (security matters)
- No external dependencies required

### Cloud (Shared Service)
- Same Go binary in Docker
- 100+ organizers, thousands of events per year
- Multiple concurrent events
- Event DB files may be archived to cold storage

Both modes use the identical codebase and database schema.

## Database Architecture

### system.db (SQLite)

One per installation. Stores authentication and event registry.

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,          -- UUID
    login TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,   -- bcrypt
    name TEXT NOT NULL,
    created_at TEXT NOT NULL       -- ISO 8601 UTC
);

CREATE TABLE events (
    id TEXT PRIMARY KEY,           -- UUID
    filename TEXT UNIQUE NOT NULL, -- path to event .db file
    display_name TEXT NOT NULL,    -- cached from event settings
    date TEXT,                     -- cached from event settings
    status TEXT DEFAULT 'active',  -- active | archived
    created_at TEXT NOT NULL
);

CREATE TABLE event_access (
    event_id TEXT NOT NULL REFERENCES events(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL,            -- admin | operator | viewer
    PRIMARY KEY (event_id, user_id)
);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    refresh_token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);
```

Notes:
- `display_name` and `date` in the events table are duplicated from event DB settings for fast listing. Updated when event settings change.
- First user created on initial setup becomes admin.
- Event creator automatically gets admin role in event_access.

### event_<uuid>.db (SQLite)

One per event. Fully self-contained — copying this file copies the entire event with all data and attachments.

```sql
-- Key-value settings (event name, date, timezone, logo purpose, etc.)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Participants
CREATE TABLE participants (
    id TEXT PRIMARY KEY,
    bib TEXT,                      -- bib number (may be empty)
    card_number TEXT,              -- timing device ID (links to punches)
    first_name TEXT,
    last_name TEXT,
    birth_date TEXT,
    gender TEXT,                   -- M | F | empty
    team_id TEXT,
    group_id TEXT,
    course_id TEXT,                -- direct course assignment (overrides group)
    dsq INTEGER DEFAULT 0,        -- manual disqualification flag
    dsq_description TEXT,
    dns INTEGER DEFAULT 0,        -- did not start flag
    dnf INTEGER DEFAULT 0,        -- did not finish flag
    notes TEXT,
    created_at TEXT NOT NULL
);

-- Teams
CREATE TABLE teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL
);

-- Age/category groups
CREATE TABLE age_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,            -- e.g., "M21", "W15", "Open A"
    course_id TEXT,                -- optional link to course
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

-- Course definitions (distance/route configurations)
CREATE TABLE courses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,            -- e.g., "50km", "Sprint A"
    checkpoints TEXT NOT NULL,     -- JSON array: ["START","LAP","LAP","FINISH"]
    validation_mode TEXT DEFAULT 'strict', -- strict | relaxed
    description TEXT,
    created_at TEXT NOT NULL
);

-- Timing marks (punches/reads from timing systems)
CREATE TABLE punches (
    id TEXT PRIMARY KEY,
    card_number TEXT NOT NULL,     -- links to participant.card_number
    checkpoint TEXT NOT NULL,      -- control point name (plain text)
    timestamp_utc TEXT NOT NULL,   -- ISO 8601 UTC
    enabled INTEGER DEFAULT 1,    -- 0 = disabled/ignored
    source TEXT,                   -- origin identifier (e.g., "reader-1", "manual")
    created_at TEXT NOT NULL
);

-- File attachments (logos, templates, headers)
CREATE TABLE files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    purpose TEXT,                  -- logo | header | footer | bib_template
    data BLOB NOT NULL,
    created_at TEXT NOT NULL
);
```

#### Indexes

```sql
CREATE INDEX idx_punches_card ON punches(card_number);
CREATE INDEX idx_punches_checkpoint ON punches(checkpoint);
CREATE INDEX idx_participants_card ON participants(card_number);
CREATE INDEX idx_participants_group ON participants(group_id);
CREATE INDEX idx_participants_course ON participants(course_id);
CREATE INDEX idx_age_groups_course ON age_groups(course_id);
```

## Participant-Course Resolution

A participant's course is resolved with this priority:

1. `participant.course_id` — direct assignment (highest priority)
2. `age_groups.course_id` where `age_groups.id = participant.group_id` — inherited from group
3. No course — participant cannot be included in results

This supports different sport conventions:
- **Orienteering (large events):** participant → group (M21) → course. Participant doesn't choose.
- **Orienteering (small events):** participant → course (A/B/C) directly. Groups irrelevant.
- **Ski racing:** participant → course (50km/10km). Results generated both by course and by group.

## Punch Flow

```
External device → POST /api/events/:id/punches → punches table
                  (batch, event-token auth)

Punches arrive as:
{
  "card_number": "12345",
  "checkpoint": "LAP",
  "timestamp": "2025-02-15T10:23:45Z"
}
```

Key behaviors:
- Punches are accepted regardless of whether the participant exists yet
- Punches are accepted regardless of whether the checkpoint is defined in any course
- card_number matching is plain text comparison, no FK constraints
- Batch writes (array of punches) for offline-first readers
- Event-token authentication (separate from user JWT) so timing devices don't need user credentials

## Result Computation

Results are NEVER stored. Always computed from:
- Participant's resolved course (see resolution above)
- All enabled punches for participant's card_number
- Course validation algorithm

### Computation steps:

1. Resolve participant's course
2. Fetch all enabled punches for participant's card_number, ordered by timestamp
3. Match punches against course checkpoint sequence
4. Apply validation (strict or relaxed)
5. Calculate split times and total time
6. Determine status (OK / DSQ / DNF)
7. Combine with manual status flags (stored dsq/dns/dnf override computed status)
8. Rank participants within course and/or group

### Validation modes:

- **strict:** Missing checkpoint = DSQ (orienteering). Wrong order = DSQ.
- **relaxed:** Missing checkpoint = show with warning (ski racing). Likely a system issue, not athlete's fault.

## Course Definition

Courses store an ordered JSON array of checkpoint names:

```json
["START", "LAP", "LAP", "FINISH"]
["31", "32", "33", "34", "35", "100"]
```

The validation algorithm is a separate, extensible module. Different sports need different logic. Detailed course validation specification will be documented in `docs/courses.md`.

## Authentication & Authorization

### Auth flow:
1. `POST /api/auth/login` → returns JWT access token + refresh token
2. Access token: short TTL (~15 min), used for API calls
3. Refresh token: stored in sessions table, longer TTL
4. Fiber middleware validates JWT and checks event_access for event-scoped endpoints

### Token types:
- **User JWT** — for human users (organizers, judges). Carries user_id and role.
- **Event token** — for timing devices and data consumers. Scoped to single event. Stored in event settings. No user identity needed.

### Roles:
- **admin** — full access to event (manage participants, courses, access, settings)
- **operator** — can input/edit data (participants, punches) but not manage access
- **viewer** — read-only access (results, live stream)

## Real-time Data Distribution

### SSE (Server-Sent Events)

```
GET /api/events/:id/stream?token=<event-token>

data: {"type":"punch","card_number":"12345","checkpoint":"FINISH","timestamp":"..."}
data: {"type":"result","bib":"42","name":"Ivanov","place":1,"time":"1:02:33"}
```

SSE chosen over WebSocket because:
- Consumers only need to receive data (unidirectional)
- Works through proxies and firewalls
- Simple to consume from any language, even curl
- Sufficient for scoreboards, video overlays, online results

## File Storage

Files (logos, templates, headers/footers) stored as BLOBs in the event DB `files` table.

Constraints:
- Max 2MB per file
- Validated on API level before insertion
- Expected file count per event: 3-5

This ensures event DB remains fully portable — one file contains everything.

## Import / Export

### Import:
- **Participants:** xlsx upload → parsed with excelize → inserted into participants table
- Endpoint: `POST /api/events/:id/participants/import` (multipart form)
- CSV as fallback format

### Export:
- **Results:** xlsx (server-side via excelize), PDF (client-side in browser)
- **Event data:** the .db file itself is the export

## Project Structure

```
openeventor/
├── CLAUDE.md
├── cmd/
│   └── server/
│       └── main.go              # Entry point
├── internal/
│   ├── auth/                    # JWT, bcrypt, middleware
│   ├── handlers/                # Fiber route handlers
│   ├── models/                  # Domain types
│   ├── database/                # SQLite connection management, migrations
│   ├── results/                 # Result computation engine
│   ├── validation/              # Course validation algorithms
│   ├── importers/               # xlsx/csv parsers
│   └── reports/                 # Report renderers (xlsx export)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── api/                 # API client
│   │   └── plugins/             # Feature modules (convention-based)
│   └── package.json
├── docs/
│   ├── architecture.md          # This file
│   ├── courses.md               # Course validation algorithms
│   ├── how-to-add-report.md     # Contributor guide
│   └── how-to-add-validator.md  # Contributor guide
├── migrations/                  # SQL migration files
├── docker-compose.yml
└── Dockerfile
```

## Extensibility

No plugin system. Extensibility via Go interfaces:

```go
// Course validation
type CourseValidator interface {
    Validate(course Course, punches []Punch) ValidationResult
    Name() string
}

// Report rendering
type ReportRenderer interface {
    Render(data ResultsData, opts RenderOptions) ([]byte, error)
    Format() string
}

// Data import
type DataImporter interface {
    Import(reader io.Reader) ([]Participant, error)
    SupportedFormats() []string
}
```

Contributors add new implementations by:
1. Creating a new file in the relevant package
2. Implementing the interface
3. Registering in the package's registry (one line)
4. Submitting a PR

## SQLite Concurrency

Both system.db and event DBs use WAL mode for concurrent read/write:

```sql
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
```

Write serialization strategy:
- Each open SQLite database has a single writer goroutine
- Writes are submitted via a Go channel
- Reads are concurrent (multiple goroutines)
- This prevents "database is locked" errors under load

For cloud deployment with multiple punch sources writing to the same event DB simultaneously, this serialization is critical.
