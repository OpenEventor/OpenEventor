# OpenEventor Architecture

## System Overview

OpenEventor is a timing and results platform for sports events. It serves as a central data hub: receiving timing data (passings) from external devices via API, computing results on the fly, and distributing them to consumers (scoreboards, video overlays, online results).

The system can be deployed locally (laptop in a timing tent, intranet) or in the cloud (shared service for multiple organizers).

## Deployment Modes

### Local (Timing Tent)
- Single Go binary + SQLite files on a laptop
- 1-5 users on local network
- WiFi may be shared with event competitors (security matters)
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

-- Competitors
CREATE TABLE competitors (
    id TEXT PRIMARY KEY,
    bib TEXT,                      -- bib number (may be empty)
    card1 TEXT,                    -- primary timing device ID (links to passings)
    card2 TEXT,                    -- secondary timing device ID (e.g. backup chip)
    team_id TEXT,
    group_id TEXT,
    course_id TEXT,                -- direct course assignment (overrides group)

    first_name TEXT,
    last_name TEXT,
    first_name_int TEXT,           -- international name (e.g. for FIS)
    last_name_int TEXT,
    gender TEXT,                   -- M | F
    birth_date TEXT,               -- full date when known
    birth_year INTEGER,            -- year only when full date unknown

    rank TEXT,                     -- free text: KMS, MS, Elite, Cat 1, etc.
    rating REAL,                   -- for seeded start calculation

    country TEXT,
    region TEXT,
    city TEXT,

    phone TEXT,
    email TEXT,

    start_time TEXT,               -- assigned start time (ISO 8601)
    time_adjustment INTEGER DEFAULT 0, -- ±seconds (+120 = penalty, -180 = handicap)

    dsq INTEGER DEFAULT 0,        -- manual disqualification flag
    dsq_description TEXT,
    dns INTEGER DEFAULT 0,        -- did not start flag
    dnf INTEGER DEFAULT 0,        -- did not finish flag
    out_of_rank INTEGER DEFAULT 0, -- non-competitive

    entry_number TEXT,             -- registration number
    price REAL,                    -- entry fee
    is_paid INTEGER DEFAULT 0,
    is_checkin INTEGER DEFAULT 0,

    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Teams
CREATE TABLE teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT,
    region TEXT,
    city TEXT,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Groups (age/category)
CREATE TABLE groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,            -- e.g., "M21", "W15", "Open A"
    course_id TEXT,                -- optional link to course
    parent_id TEXT,                -- parent group for combined rankings
    gender TEXT,                   -- M | F (filter for auto-assignment)
    year_from INTEGER,             -- birth year range start
    year_to INTEGER,               -- birth year range end
    start_time TEXT,               -- group start time (mass start)
    price REAL,                    -- entry fee for this group
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Course definitions (distance/route configurations)
CREATE TABLE courses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,            -- e.g., "50km", "Sprint A"
    checkpoints TEXT NOT NULL,     -- JSON array: ["START","LAP","LAP","FINISH"]
    validation_mode TEXT DEFAULT 'strict', -- strict | relaxed
    geo_track TEXT,                -- GeoJSON track
    length REAL,                   -- distance in meters
    altitude REAL,                 -- max altitude in meters
    climb REAL,                    -- elevation gain in meters
    start_time TEXT,               -- course start time (mass start)
    price REAL,                    -- entry fee
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Timing data from external devices
CREATE TABLE passings (
    id TEXT PRIMARY KEY,
    card TEXT NOT NULL,            -- links to competitor.card
    checkpoint TEXT NOT NULL,      -- control point name (plain text)
    timestamp REAL NOT NULL DEFAULT 0, -- unix seconds (2 decimal places)
    enabled INTEGER DEFAULT 1,    -- 0 = disabled/ignored
    source TEXT,                   -- origin identifier (e.g., "reader-1", "manual")
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Check-in audit log
CREATE TABLE checkins (
    id TEXT PRIMARY KEY,
    competitor_id TEXT NOT NULL,
    user_id TEXT,                  -- who performed the operation (from system.db)
    status INTEGER NOT NULL,      -- 1 = checked in, 0 = unchecked
    created_at TEXT NOT NULL
);

-- Payment audit log
CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    competitor_id TEXT NOT NULL,
    user_id TEXT,                  -- who processed (from system.db)
    amount REAL NOT NULL,          -- positive = payment, negative = refund
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
CREATE INDEX idx_checkins_competitor ON checkins(competitor_id);
CREATE INDEX idx_payments_competitor ON payments(competitor_id);
CREATE INDEX idx_passings_card ON passings(card);
CREATE INDEX idx_passings_checkpoint ON passings(checkpoint);
CREATE INDEX idx_competitors_card1 ON competitors(card1);
CREATE INDEX idx_competitors_card2 ON competitors(card2);
CREATE INDEX idx_competitors_group ON competitors(group_id);
CREATE INDEX idx_competitors_course ON competitors(course_id);
CREATE INDEX idx_groups_course ON groups(course_id);
```

## Competitor-Course Resolution

A competitor's course is resolved with this priority:

1. `competitor.course_id` — direct assignment (highest priority)
2. `groups.course_id` where `groups.id = competitor.group_id` — inherited from group
3. No course — competitor cannot be included in results

This supports different sport conventions:
- **Orienteering (large events):** competitor → group (M21) → course. Competitor doesn't choose.
- **Orienteering (small events):** competitor → course (A/B/C) directly. Groups irrelevant.
- **Ski racing:** competitor → course (50km/10km). Results generated both by course and by group.

## Passing Flow

```
External device → POST /api/events/:id/passings → passings table
                  (batch, event-token auth)

Passings arrive as:
{
  "card": "12345",
  "checkpoint": "LAP",
  "timestamp": "2025-02-15T10:23:45Z"
}
```

Key behaviors:
- Passings are accepted regardless of whether the competitor exists yet
- Passings are accepted regardless of whether the checkpoint is defined in any course
- `card` matching is plain text comparison, no FK constraints
- Batch writes (array of passings) for offline-first readers
- Event-token authentication (separate from user JWT) so timing devices don't need user credentials

## Result Computation

Results are NEVER stored. Always computed from:
- Competitor's resolved course (see resolution above)
- All enabled passings for competitor's `card`
- Course validation algorithm

### Computation steps:

1. Resolve competitor's course
2. Fetch all enabled passings for competitor's `card`, ordered by timestamp
3. Match passings against course checkpoint sequence
4. Apply validation (strict or relaxed)
5. Calculate split times and total time
6. Determine status (OK / DSQ / DNF)
7. Combine with manual status flags (stored dsq/dns/dnf override computed status)
8. Rank competitors within course and/or group

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
- **admin** — full access to event (manage competitors, courses, access, settings)
- **operator** — can input/edit data (competitors, passings) but not manage access
- **viewer** — read-only access (results, live stream)

## Real-time Data Distribution

### SSE (Server-Sent Events)

```
GET /api/events/:id/stream?token=<event-token>

data: {"type":"passing","card":"12345","checkpoint":"FINISH","timestamp":"..."}
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
- **Competitors:** xlsx upload → parsed with excelize → inserted into competitors table
- Endpoint: `POST /api/events/:id/competitors/import` (multipart form)
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
    Validate(course Course, passings []Passing) ValidationResult
    Name() string
}

// Report rendering
type ReportRenderer interface {
    Render(data ResultsData, opts RenderOptions) ([]byte, error)
    Format() string
}

// Data import
type DataImporter interface {
    Import(reader io.Reader) ([]Competitor, error)
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

For cloud deployment with multiple timing sources writing to the same event DB simultaneously, this serialization is critical.
