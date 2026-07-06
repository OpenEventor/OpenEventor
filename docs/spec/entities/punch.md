# Punch · `PUNCH`

> A timing mark: "card X was seen at control Y at time T". The atomic input from
> which results are computed. Code/DB name: `passing`. Russian: отсечка.

## Status

| Platform | Status | Version | Notes |
|---|---|---|---|
| iOS | ✅ | — | `Passing` in OpenEventorStore |
| Web | ✅ | v0.1.0 | `passings` table per event DB |
| Legacy | ✅ | — | origin of the model |

## Purpose

Everything downstream (splits, results, the monitor) is derived from punches.
A punch is deliberately **dumb and orphan-friendly**: it stores a raw card and a
control *name*, with **no foreign keys**. A punch for a card that matches no
competitor is valid and preserved (it may match later, or reveal a data problem).

## Data model

| Field | Type | Default | Meaning |
|---|---|---|---|
| `id` | string | uuid | — |
| `card` | string | — | chip/card number as read. Matched to a competitor by string equality against `card1`/`card2`. |
| `checkpoint` | string | — | the **Control name** (canonical). This is the join key to a course, not an id. |
| `rawCode` | string | "" | the original station/loop code as received (audit + rename source). |
| `timestamp` | float (Unix s) | — | centisecond precision. **The natural order of punches.** |
| `enabled` | int (0/1) | 1 | disabled punches are ignored by results but kept for audit. |
| `source` | string | "device" | who created it: device / manual / a timing-system name / "demo". |
| `sortOrder` | int | **0** | manual display-order override. See the big warning below. |

## Behaviour & rules

### Ordering — punches sort by **time**, `sortOrder` is an exception

The natural order of a competitor's punches is **chronological (`timestamp`)**.
`sortOrder` exists only for **exceptional manual reordering** — when a judge fixes
an order that time can't express (clock drift between stations, hand-entered
punches with no/rough time, ties, out-of-order transmission).

- Default for **every** source (device, timing system, manual, demo) is `sortOrder = 0`.
- With all `sortOrder = 0`, punches sort purely by time → correct.
- The Punches Monitor and the punch editor sort by **`[sortOrder ASC, timestamp ASC]`** — `sortOrder` is the **primary** key so a manual override actually moves a punch.
- **Results ignore `sortOrder` entirely** — the results engine sorts strictly by time (`sortedByTime`). So `sortOrder` is a *display/editor* concern only; it never changes who wins.

### Control name resolution (`rawCode` → `checkpoint`)

Hardware sends a raw station code in `rawCode`. A Timing System rename rule maps
`rawCode` → a Control name and optionally shifts the clock (± seconds). If no rule
matches, `checkpoint` = the raw code verbatim. See `TIMING-RECEIVER`.

### Example: why a later punch can land in the *middle* (the `sortOrder` trap)

Real case that cost us an afternoon. A competitor's punches:

| control | source | sortOrder | day |
|---|---|---|---|
| START | demo | **1** | 21 |
| 31 | demo | **2** | 21 |
| 32 | demo | **3** | 21 |
| FINISH | demo | **4** | 21 |
| JOPA | timing system | **0** | **22** |

A new punch `JOPA` arrives on day 22 (the latest time), inserted with `sortOrder = 0`.
Sorting by `[sortOrder ASC, timestamp ASC]`:

```
sortOrder 0 bucket:  JOPA (day22)              ← lowest sortOrder wins, regardless of time
sortOrder 1..4:      START, 31, 32, FINISH
→ displayed:         JOPA, START, 31, 32, FINISH
```

JOPA jumps to the **front**, not the end — its day-22 timestamp only ranks it
*within* the `sortOrder = 0` bucket. The monitor then computes each leg from the
previous *displayed* block, so JOPA→START shows a nonsense **negative** split.

**Root cause:** the demo seeded punches with an *increasing* `sortOrder`; live
punches use `0`. Mixed `sortOrder` + primary-sort-by-`sortOrder` = time is ignored
across buckets.

## Gotchas / traps

- **Never pre-assign `sortOrder` to punches** (the demo did → this bug). It must
  stay `0` unless a human deliberately reordered *that* punch. Fixed 2026-07-06.
- `sortOrder` is the **primary** monitor/editor sort key but is **ignored by
  results** — don't assume the monitor order equals the scored order.
- Matching is **by string** (`card` == competitor card, `checkpoint` == course
  control name), never by id. Rename/typo/whitespace → silent mismatch, not an error.
- A negative split in the monitor almost always means display order ≠ chronological
  order (i.e. a `sortOrder` artefact), not a bad timestamp.

## Surface

- **Ingest (device/token):** `POST /api/events/:id/passings` (batch); timing systems via `TIMING-RECEIVER`.
- **CRUD (JWT):** `GET/POST /api/events/:id/passings*`, `PUT/DELETE …/:passingId`.
- **UI:** Punches Monitor (`PUNCHES-MONITOR`), the punch editor (reorder = sets `sortOrder`), competitor card.

## Cross-platform notes

- iOS ingests via `PunchServer` → `EventStore.save(Passing)`; Web via the timing
  receiver → `passings` insert. Both store the resolved **name** in `checkpoint`
  and the original code in `rawCode`.
- Name-based matching (no FK) is identical across iOS / Web / Legacy — a
  deliberate, shared design choice.

## Open questions / TODO

- Should live ingest append `sortOrder = max+1` instead of `0`, so a manually
  reordered list survives new punches? (Currently `0` + "don't pre-seed" is enough.)

## Changelog

- 2026-07-06 — Demo stopped pre-seeding punch `sortOrder` (was `0..N`, now `0`);
  documented the ordering trap. Behaviour otherwise unchanged since v0.1.0.
