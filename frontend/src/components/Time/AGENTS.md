# Time Components

This directory contains all time-related display and input components.

## File Structure

```
Time/
├── index.ts          — re-exports all public API
├── utils.ts          — shared helpers (pad, toTimestamp, fromTimestamp, dateDiffDays, etc.)
├── Time.tsx          — absolute time display
├── Delta.tsx         — delta (time difference) display
├── TimeInput.tsx     — time input field with scrub, keyboard, day segment
└── AGENTS.md         — this file
```

## Components

### `<Time>` — Absolute time display

Renders a timestamp as human-readable time relative to event date.

```tsx
<Time value={1700000000} baseDate="2025-11-14" timezone="UTC" />
// → "12:14:22.41"

<Time value={1700086400} baseDate="2025-11-14" timezone="UTC" />
// → "1d 12:14:22.41"
```

**Props:**
- `value: number | null` — Unix timestamp (seconds with centisecond precision). Renders empty fragment if null/undefined/0/negative.
- `baseDate: string` — Event date in YYYY-MM-DD format. **Always the event date** from `useEvent().date`.
- `timezone?: string` — IANA timezone string. Default `"UTC"`. Use `useEvent().timezone`.

**Renders:** bare `<>...</>` fragment — no wrapper elements. Wrap in `<Typography>` or any container as needed.

**Day prefix:** If the timestamp falls on a day after baseDate, a day prefix is shown (`1d`, `2d`, etc.).

---

### `<Delta>` — Time delta display

Renders a time difference (in seconds) with sign prefix and smart formatting.

```tsx
<Delta value={332.41} />   // → "+05:32.41"
<Delta value={32.41} />    // → "+32.41"
<Delta value={3932.41} />  // → "+01:05:32.41"
<Delta value={90132.41} /> // → "+1d 01:02:12.41"
<Delta value={-5.3} />     // → "-5.30"
```

**Props:**
- `value: number` — Delta in seconds (positive or negative).

**Renders:** bare `<>...</>` fragment.

**Trimming:** Leading zero parts are trimmed from the left:
- `1d 02:05:32.41` — full (days > 0)
- `02:05:32.41` — 0 days omitted
- `05:32.41` — 0 days + 0 hours omitted
- `32.41` — only seconds remain

Always shows at least `seconds.centiseconds`.

---

### `<TimeInput>` — Time input field

MUI-based time input with scrub (drag), keyboard arrows, and day segment support.

```tsx
<TimeInput
  value={timestamp}
  baseDate={baseDate}
  timezone={timezone}
  onChange={(ts) => setTimestamp(ts)}
  size="small"
  label="Start time"
/>
```

**Key props:**
- `value: number | null` — Unix timestamp or null.
- `baseDate: string` — Event date (YYYY-MM-DD). **Always from `useEvent().date`**.
- `timezone: string` — From `useEvent().timezone`.
- `onChange: (value: number | null) => void` — Fires on every edit (scrub, arrow, typing) for real-time updates.
- `allowChangeDate?: boolean` — Show calendar icon to override date (multi-day events).
- `size`, `variant`, `label`, `disabled`, `error`, `helperText`, `fullWidth`, `sx` — Standard MUI form field props.

**Day segment:** When value is 24+ hours after baseDate, a "Xd" segment appears automatically.

**Internal architecture:**
- `value` prop → `parsed` (useMemo) → `derivedSections` / `derivedDays` for display
- On edit: `localSections` / `localDays` state overrides derived values
- `fireChange()` reads local refs and calls onChange immediately
- On blur: `commit()` normalizes and clears local state

---

## Shared Utilities (`utils.ts`)

- `pad(n)` — zero-pad to 2 digits
- `toTimestamp(dateStr, h, m, s, cs, timezone)` — build Unix timestamp from parts
- `fromTimestamp(timestamp, timezone)` — decompose timestamp into parts
- `dateDiffDays(base, other)` — days between two YYYY-MM-DD strings
- `addDays(dateStr, days)` — add days to a date string
- `clampValue(current, delta, min, max)` — clamp arithmetic
- `normalizeSections(secs, configs)` — pad/clamp raw section strings

The `Intl.DateTimeFormat` instance is cached per timezone for performance.

---

## Core Principles

### baseDate is ALWAYS the event date

Every component that displays or inputs time receives `baseDate` from `useEvent().date`. This is the date of the event (stored in event settings, formatted as YYYY-MM-DD).

```tsx
const { date: baseDate, timezone } = useEvent();
```

Never compute baseDate from the timestamp itself or from the current date. The event date is the single source of truth.

### Timezone comes from EventContext

All time display and input uses `useEvent().timezone`. Currently defaults to `"UTC"` but will support arbitrary IANA timezones when event settings allow it.

### No direct time formatting

Do not use `new Date()`, `getUTCHours()`, `toLocaleString()`, or manual time formatting anywhere in the app. Always use `<Time>` for display and `<TimeInput>` for input.

For non-React contexts (e.g., DataGrid `renderCell`), create a small wrapper component that calls `useEvent()`:

```tsx
function StartTimeCell({ value }: { value: number }) {
  const { date: baseDate, timezone } = useEvent();
  if (!value || value <= 0) return null;
  return <Time value={value} baseDate={baseDate} timezone={timezone} />;
}
```

### Deltas are timezone-agnostic

`<Delta>` accepts a difference in seconds — pure math, no timezone involved. Use with `computeDeltas()` from `PassingBlock` or compute manually (`to - from`).

---

## Usage Checklist

When adding time display anywhere in the app:

1. Import `Time` or `Delta` from `components/Time`
2. Get `baseDate` and `timezone` from `useEvent()`
3. Pass them to `<Time value={...} baseDate={baseDate} timezone={timezone} />`
4. For deltas, use `<Delta value={diffInSeconds} />`
5. For input, use `<TimeInput value={...} baseDate={baseDate} timezone={timezone} onChange={...} />`
