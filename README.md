# OpenEventor

Open-source timing and results platform for sports events (orienteering, skiing, running, multisport).

## Features

- Receive timing data (passings) from external devices via API
- Compute results on the fly from passings + course definitions
- Real-time distribution via SSE (scoreboards, video overlays, online results)
- Per-event SQLite databases — copy one .db file = copy the entire event
- Single binary with embedded frontend — no external dependencies

## Quick Start

```bash
# Download the binary for your platform from Releases, then:
./openeventor
```

The browser opens automatically at `http://localhost:5050`. Use `--no-browser` flag to disable this (e.g. on a server).

## Build from Source

Prerequisites: Go 1.23+, Node.js 20+

```bash
make build              # macOS
make build-windows      # Windows (.exe), requires mingw-w64
make build-linux-arm64  # Linux ARM64 (Raspberry Pi), requires cross-compiler
make build-all          # all platforms
```

Output: `dist/openeventor` — a single binary with the frontend embedded.

## Development

```bash
# Backend
go run ./cmd/server

# Frontend (separate terminal)
cd frontend && npm install && npm run dev

# Tests
go test ./...
```

## Architecture

OpenEventor is a data hub: it receives timing marks from external sources and serves results to consumers.

```
Data Producers → OpenEventor API → Data Consumers

SPORTident app  →                → Video overlay
SFR app         →  passings API  → LED scoreboard
Mobile timer    →  + SSE stream  → Online results
Manual input    →                → Telegram bot
```

See [docs/architecture.md](docs/architecture.md) for full details.

## Tech Stack

- **Backend:** Go (Fiber framework)
- **Frontend:** React + MUI (Material UI)
- **Database:** SQLite (one DB per event + one system DB)
- **Auth:** JWT (bcrypt for passwords)

## Deployment

### Local (Timing Tent)

Run the binary on a laptop. Judges connect from phones via Wi-Fi at `http://<laptop-ip>:5050`.

### Raspberry Pi

Build natively on the Pi or cross-compile with `make build-linux-arm64`. Same single binary.

### Cloud

Same binary in Docker or as a systemd service. Use `--no-browser` flag.

## License

See [LICENSE](LICENSE).
