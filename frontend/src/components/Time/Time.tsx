import { pad, fromTimestamp, dateDiffDays } from './utils';

export interface TimeProps {
  value: number | null;
  baseDate: string;
  timezone?: string;
}

/**
 * Renders absolute time relative to baseDate.
 * Examples: "1d 12:14:22.41", "12:14:22.41"
 * Returns bare fragment — no wrapper elements.
 */
export default function Time({ value, baseDate, timezone = 'UTC' }: TimeProps) {
  if (value === null || value === undefined || typeof value !== 'number' || !isFinite(value) || value <= 0) {
    return <></>;
  }

  const parsed = fromTimestamp(value, timezone);
  const days = dateDiffDays(baseDate, parsed.date);

  const time = `${pad(parsed.hours)}:${pad(parsed.minutes)}:${pad(parsed.seconds)}.${pad(parsed.centiseconds)}`;

  return <>{days > 0 ? `${days}d ${time}` : time}</>;
}
