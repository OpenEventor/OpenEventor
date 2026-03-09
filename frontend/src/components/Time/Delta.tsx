import { pad } from './utils';

export interface DeltaProps {
  /** Delta in seconds (positive or negative). */
  value: number;
}

/**
 * Renders a time delta with sign prefix.
 * Trims leading zero parts from left:
 *   +1d 02:05:32.41 (full)
 *   +02:05:32.41    (0 days omitted)
 *   +05:32.41       (0 days + 0 hours omitted)
 *   +32.41          (only seconds remain)
 * Always shows at least seconds.centiseconds.
 * Returns bare fragment — no wrapper elements.
 */
export default function Delta({ value }: DeltaProps) {
  const sign = value < 0 ? '-' : '+';
  const abs = Math.abs(value);

  const totalCs = Math.round(abs * 100);
  const cs = totalCs % 100;
  const totalSeconds = Math.floor(totalCs / 100);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const h = totalHours % 24;
  const d = Math.floor(totalHours / 24);

  let result: string;

  if (d > 0) {
    result = `${d}d ${pad(h)}:${pad(m)}:${pad(s)}.${pad(cs)}`;
  } else if (h > 0) {
    result = `${pad(h)}:${pad(m)}:${pad(s)}.${pad(cs)}`;
  } else if (m > 0) {
    result = `${pad(m)}:${pad(s)}.${pad(cs)}`;
  } else {
    result = `${s}.${pad(cs)}`;
  }

  return <>{sign}{result}</>;
}
