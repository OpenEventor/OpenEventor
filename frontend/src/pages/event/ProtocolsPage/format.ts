// Column-key metadata and cell formatting shared by the on-screen preview and the
// PDF export, so both render the backend Document identically. Column keys come
// from the backend `columns` list:
//   place, bib, lastName, firstName, group, team, country, rank,
//   start, result, gapLeader, gapPrev, points, comment, status
import type { TFunction } from 'i18next';
import { fromTimestamp } from '../../../components/Time';
import type { ProtocolRow } from '../../../api/types.ts';

/**
 * Localized header label for a column key (`protocols.columns.<key>`), falling
 * back to the raw key for anything unmapped.
 */
export function columnLabel(key: string, t: TFunction): string {
  return t(`protocols.columns.${key}`, { defaultValue: key });
}

const RIGHT_ALIGNED = new Set(['place', 'bib', 'start', 'result', 'gapLeader', 'gapPrev', 'points']);
/** Numeric / time columns are right-aligned; everything else left. */
export function columnAlign(key: string): 'left' | 'right' {
  return RIGHT_ALIGNED.has(key) ? 'right' : 'left';
}

const FLEX = new Set(['lastName', 'firstName', 'team', 'comment', 'group']);
/** Columns that should stretch to fill remaining width in the PDF table. */
export function columnFlex(key: string): boolean {
  return FLEX.has(key);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Milliseconds → "mm:ss.cs" (or "h:mm:ss.cs" once past an hour). */
export function formatDuration(ms: number): string {
  const totalCs = Math.round(ms / 10);
  const cs = totalCs % 100;
  const totalSeconds = Math.floor(totalCs / 100);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  return h > 0
    ? `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`
    : `${pad(m)}:${pad(s)}.${pad(cs)}`;
}

/**
 * Absolute start time relative to the event date, e.g. "10:03:00" or "1d 10:03:00".
 * Mirrors the <Time> component (day prefix when the timestamp is a later day).
 */
export function formatAbsolute(startSeconds: number, baseDate: string, timezone: string): string {
  if (!startSeconds || startSeconds <= 0) return '';
  const p = fromTimestamp(startSeconds, timezone);
  const days = Math.round(
    (Date.parse(`${p.date}T00:00:00Z`) - Date.parse(`${baseDate}T00:00:00Z`)) / 86400000,
  );
  const t = `${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}`;
  return days > 0 ? `${days}d ${t}` : t;
}

/** Trim trailing zeros from a rating value ("850", "12.5"). */
export function formatPoints(n: number): string {
  return String(Number(n.toFixed(2)));
}

export interface FormatContext {
  baseDate: string;
  timezone: string;
}

/** Text for one cell of the given column key. Empty string for absent values. */
export function cellText(row: ProtocolRow, key: string, ctx: FormatContext): string {
  switch (key) {
    case 'place':
      return row.place != null ? String(row.place) : '';
    case 'bib':
      return row.bib;
    case 'lastName':
      return row.lastName;
    case 'firstName':
      return row.firstName;
    case 'group':
      return row.groupName;
    case 'team':
      return row.teamName;
    case 'country':
      return row.country;
    case 'rank':
      return row.rank;
    case 'start':
      return formatAbsolute(row.startTime, ctx.baseDate, ctx.timezone);
    case 'result':
      return row.totalTime != null ? formatDuration(row.totalTime) : '';
    case 'gapLeader':
      return row.gapToLeader != null ? `+${formatDuration(row.gapToLeader)}` : '';
    case 'gapPrev':
      return row.gapToPrev != null ? `+${formatDuration(row.gapToPrev)}` : '';
    case 'points':
      return row.points != null ? formatPoints(row.points) : '';
    case 'comment':
      return row.comment;
    case 'status':
      // OK finishers leave the status cell blank; non-finishers show DSQ/DNF/DNS/NC.
      return row.status && row.status !== 'OK' ? row.status : '';
    default:
      return '';
  }
}
