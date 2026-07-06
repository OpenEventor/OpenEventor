# OpenEventor — Feature Specification

The single source of truth for **what each entity and feature does**, independent
of platform. One Markdown file per entity/feature. We write these so we (1) don't
re-confuse ourselves about our own rules, and (2) can port and track features
consistently across every build — **iOS**, **Web**, and the **Legacy** Laravel app.

> Rule of thumb: if a behaviour has a non-obvious rule or a trap (like punch
> `sortOrder`), it MUST have a worked example here. If it's not in the spec with
> an example, it will be forgotten.

## Conventions

- **One file per entity or feature.** Entities in `entities/`, features/modules in `features/`.
- **Canonical name + ID.** Every spec has a canonical name and a short `SCREAMING-KEBAB` ID (e.g. `PUNCH`, `PUNCHES-MONITOR`). Use canonical names everywhere — in specs, UI (English), and discussion.
- **File name = kebab-case of the ID.** `PUNCH` → `entities/punch.md`.
- **Platform status table** at the top of every spec (see legend). This is how we track parity.
- **Examples are mandatory** for any ordering/matching/scoring rule.
- Start from `_TEMPLATE.md`.

## Status legend

| Symbol | Meaning |
|---|---|
| ✅ | Implemented & current |
| 🟡 | Partial / diverges (see notes) |
| 📋 | Planned / not yet built |
| ➖ | Not applicable on this platform |

Platforms tracked: **iOS** · **Web** · **Legacy** (Laravel).

## Canonical glossary

The terminology cleanup mapped literal RU→EN translations to IOF-standard English.
Canonical name first; other columns are synonyms you'll meet in code/UI/history.

| Canonical | Code / DB | Russian | Old / literal EN |
|---|---|---|---|
| **Control** | `checkpoint`, `checkpoints` | Контрольный пункт (КП) | Checkpoint |
| **Course** | `course`, `courseId` | Дистанция | Distance |
| **Class** | `group`, `groupId` | Группа | Group |
| **Punch** | `passing`, `passings` | Отсечка / отметка | Passing |
| **Issue** | `problem` | Разбор проблем | Problem |
| **Competitor** | `competitor` | Участник | — |
| **Team** | `team` | Команда | — |
| **Event** | `event` | Мероприятие | — |
| **Timing System** | `timing_system` | Тайминг-система | — |
| **Result** | (computed) | Результат | — |
| **Protocol** | `protocol` | Протокол | — |

> Note: code identifiers (`courseId`, `groupId`, `checkpoint`) are intentionally
> left as-is — they're internal, not user-facing. Only display strings use the
> canonical English names.

## Index

Legend order in each row: **iOS · Web · Legacy**.

### Entities

| ID | Name | iOS | Web | Legacy | Spec |
|---|---|---|---|---|---|
| `PUNCH` | Punch | ✅ | ✅ | ✅ | [entities/punch.md](entities/punch.md) |
| `CONTROL` | Control | ✅ | ✅ | 🟡 | 📋 stub |
| `COURSE` | Course | ✅ | ✅ | ✅ | 📋 stub |
| `CLASS` | Class | ✅ | ✅ | ✅ | 📋 stub |
| `COMPETITOR` | Competitor | ✅ | ✅ | ✅ | 📋 stub |
| `TEAM` | Team | ✅ | ✅ | ✅ | 📋 stub |
| `EVENT` | Event | ✅ | ✅ | ✅ | 📋 stub |
| `TIMING-SYSTEM` | Timing System | ✅ | ✅ | ➖ | 📋 stub |

### Features

| ID | Name | iOS | Web | Legacy | Spec |
|---|---|---|---|---|---|
| `PUNCHES-MONITOR` | Punches Monitor | ✅ | 🟡 | ✅ | 📋 stub |
| `TIMING-RECEIVER` | Timing Receiver | ✅ | ✅ | ➖ | 📋 stub |
| `RESULTS-ENGINE` | Results Engine | ✅ | ✅ | ✅ | 📋 stub |
| `ISSUES-RESOLVER` | Issues Resolver | 🟡 | ✅ | ➖ | 📋 stub |
| `PROTOCOLS` | Protocols Generator | 🟡 | ✅ | ✅ | 📋 stub |
| `IMPORT` | Import | ✅ | 🟡 | ✅ | 📋 stub |
| `EXPORT-BACKUP` | Export & Backup | ✅ | ✅ | ➖ | 📋 stub |

Fill in stubs gradually — copy `_TEMPLATE.md`, flip the row link, keep the status
columns honest.
