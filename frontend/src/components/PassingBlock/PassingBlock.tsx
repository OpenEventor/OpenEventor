import { Box, Typography, useTheme } from '@mui/material';
import type { Passing } from '../../api/types';

// ─── Color Utilities ────────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function lerpColor(from: string, to: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

/** Relative luminance (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// ─── Time Formatting ────────────────────────────────────────

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const cs = String(Math.floor((timestamp % 1) * 100) % 100).padStart(2, '0');
  return `${hh}:${mm}:${ss}.${cs}`;
}

export function formatDelta(seconds: number): string {
  const sign = seconds < 0 ? '-' : '+';
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sFixed = s.toFixed(1);
  return m > 0 ? `${sign}${m}:${sFixed.padStart(4, '0')}` : `${sign}${sFixed}`;
}

/** Compute deltas: time difference from previous enabled passing. */
export function computeDeltas(passings: Passing[]): (number | null)[] {
  const deltas: (number | null)[] = [];
  let prevEnabled: number | null = null;
  for (const p of passings) {
    if (p.enabled === 1 && prevEnabled !== null) {
      deltas.push(p.timestamp - prevEnabled);
    } else {
      deltas.push(null);
    }
    if (p.enabled === 1) prevEnabled = p.timestamp;
  }
  return deltas;
}

// ─── PassingBlock Component ─────────────────────────────────

export interface PassingBlockProps {
  passing: Passing;
  /** Delta in seconds from previous enabled passing (null if first). */
  delta: number | null;
  /** Override background color (e.g. for highlight animation). */
  bgcolor?: string;
  /** Extra sx applied to the root Box. */
  sx?: Record<string, unknown>;
  /** Event handlers forwarded to root Box. */
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export default function PassingBlock({ passing, delta, bgcolor: bgOverride, sx, onDoubleClick, onContextMenu }: PassingBlockProps) {
  const theme = useTheme();
  const enabled = passing.enabled === 1;

  const normalBg = enabled
    ? theme.palette.primary.main
    : (theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[300]);

  const bg = bgOverride ?? normalBg;
  const hoverBrightness = luminance(bg) > 0.5 ? 0.8 : 1.2;

  return (
    <Box
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        px: 1,
        py: 0.5,
        borderRadius: 1,
        bgcolor: bg,
        color: enabled ? 'primary.contrastText' : 'text.secondary',
        position: 'relative',
        minWidth: 72,
        height: '100%',
        cursor: 'default',
        userSelect: 'none',
        flexShrink: 0,
        '&:hover': {
          filter: `brightness(${hoverBrightness})`,
        },
        ...sx,
      }}
    >
      {passing.sortOrder !== 0 && (
        <Typography variant="caption" sx={{ position: 'absolute', top: 2, right: 4, fontSize: '0.55rem', lineHeight: 1, opacity: 0.5 }}>
          #{passing.sortOrder}
        </Typography>
      )}
      <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
        {passing.checkpoint}
      </Typography>
      <Typography variant="caption" sx={{ fontFamily: 'monospace', lineHeight: 1.2, opacity: 0.9 }}>
        {formatTime(passing.timestamp)}
      </Typography>
      {delta !== null && (
        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.65rem', lineHeight: 1, opacity: 0.7 }}>
          {formatDelta(delta)}
        </Typography>
      )}
    </Box>
  );
}
