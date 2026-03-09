// ── Shared time utilities ─────────────────────────────────────────
// Used by Time, Delta, and TimeInput components.
// All timezone conversion goes through Intl.DateTimeFormat.

/** Zero-pad a number to 2 digits. */
export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// ── Timezone-aware timestamp conversion ──────────────────────────

/** Cache DateTimeFormat instances per timezone for performance. */
const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormat(timezone: string): Intl.DateTimeFormat {
  let dtf = dtfCache.get(timezone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    dtfCache.set(timezone, dtf);
  }
  return dtf;
}

/**
 * Get the offset in milliseconds between UTC and a timezone for a given date.
 * Positive offset means the timezone is behind UTC.
 */
function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: timezone });
  return new Date(utcStr).getTime() - new Date(tzStr).getTime();
}

/**
 * Build a Unix timestamp (seconds, centisecond precision) from date parts.
 * Handles timezone conversion: the provided h/m/s/cs are interpreted in the given timezone.
 */
export function toTimestamp(
  dateStr: string,
  h: number,
  m: number,
  s: number,
  cs: number,
  timezone: string,
): number {
  const isoStr = `${dateStr}T${pad(h)}:${pad(m)}:${pad(s)}Z`;
  const asUtc = new Date(isoStr);
  const offsetMs = getTimezoneOffsetMs(asUtc, timezone);
  return (asUtc.getTime() + offsetMs) / 1000 + cs / 100;
}

/**
 * Decompose a Unix timestamp into date parts in a given timezone.
 * Returns { date: "YYYY-MM-DD", hours, minutes, seconds, centiseconds }.
 */
export function fromTimestamp(
  timestamp: number,
  timezone: string,
): {
  date: string;
  hours: number;
  minutes: number;
  seconds: number;
  centiseconds: number;
} {
  const totalCs = Math.round(timestamp * 100);
  const cs = totalCs % 100;
  const wholeSeconds = Math.floor(totalCs / 100);
  const date = new Date(wholeSeconds * 1000);

  const parts = getDateTimeFormat(timezone).formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '0';

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hours: parseInt(get('hour'), 10),
    minutes: parseInt(get('minute'), 10),
    seconds: parseInt(get('second'), 10),
    centiseconds: cs,
  };
}

// ── Date arithmetic ──────────────────────────────────────────────

/** Number of full days between two YYYY-MM-DD strings. */
export function dateDiffDays(base: string, other: string): number {
  const b = new Date(base + 'T00:00:00Z');
  const o = new Date(other + 'T00:00:00Z');
  return Math.round((o.getTime() - b.getTime()) / 86400000);
}

/** Add days to a YYYY-MM-DD string, returns YYYY-MM-DD. */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Section helpers (used by TimeInput) ──────────────────────────

/** Clamp a value + delta within [min, max]. */
export function clampValue(current: number, delta: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, current + delta));
}

/** Normalize raw section strings: pad, clamp, empty → "00". */
export function normalizeSections(secs: string[], sections: readonly { min: number; max: number }[]): string[] {
  return secs.map((s, i) => {
    if (s === '') return '00';
    const n = parseInt(s, 10);
    const config = sections[i];
    return pad(Math.min(Math.max(isNaN(n) ? 0 : n, config.min), config.max));
  });
}
