import { useState, useEffect, type MouseEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, useTheme } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DisabledByDefaultIcon from '@mui/icons-material/DisabledByDefault';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import type { Passing } from '../../../api/types';
import { api } from '../../../api/client';
import { freshPassingIds, renderLock, pauseRefresh } from './useMonitorStore';
import DropDownMenu from '../../../components/DropDownMenu/DropDownMenu';
import type { DropDownMenuConfig } from '../../../components/DropDownMenu/types';

const HIGHLIGHT_COLOR = '#0051d8';
const HIGHLIGHT_STEPS = 5;
const STEP_MS = 200;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(from: string, to: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

/** Relative luminance (0 = black, 1 = white). */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

interface PassingBlockProps {
  passing: Passing;
  /** Delta in seconds from previous enabled passing (null if first). */
  delta: number | null;
  /** Called when user picks an action from the context menu. */
  onMenuAction?: (action: 'edit' | 'add-before' | 'add-after') => void;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const cs = String(Math.floor((timestamp % 1) * 100) % 100).padStart(2, '0');
  return `${hh}:${mm}:${ss}.${cs}`;
}

function formatDelta(seconds: number): string {
  const sign = seconds < 0 ? '-' : '+';
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sFixed = s.toFixed(1);
  return m > 0 ? `${sign}${m}:${sFixed.padStart(4, '0')}` : `${sign}${sFixed}`;
}

export default function PassingBlock({ passing, delta, onMenuAction }: PassingBlockProps) {
  const { eventId } = useParams<{ eventId: string }>();
  const theme = useTheme();
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const enabled = passing.enabled === 1;

  const toggleEnabled = () => {
    handleMenuClose();
    if (!eventId) return;
    api.put(`/api/events/${eventId}/passings/${passing.id}`, {
      card: passing.card,
      checkpoint: passing.checkpoint,
      timestamp: passing.timestamp,
      enabled: enabled ? 0 : 1,
      source: passing.source,
    });
    pauseRefresh.request();
  };

  // Highlight animation: consume fresh flag on mount.
  const [hlStep, setHlStep] = useState<number>(() => {
    if (freshPassingIds.has(passing.id)) {
      freshPassingIds.delete(passing.id);
      return 0;
    }
    return HIGHLIGHT_STEPS;
  });

  // Consume fresh flag for updates on already-mounted component.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (freshPassingIds.has(passing.id)) {
      freshPassingIds.delete(passing.id);
      setHlStep(0);
    }
  });

  // Advance highlight step.
  useEffect(() => {
    if (hlStep >= HIGHLIGHT_STEPS) return;
    const timer = setTimeout(() => setHlStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [hlStep]);

  const normalBg = enabled ? theme.palette.primary.main : (theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[300]);
  const bgcolor = hlStep < HIGHLIGHT_STEPS
    ? lerpColor(HIGHLIGHT_COLOR, normalBg, hlStep / HIGHLIGHT_STEPS)
    : undefined;

  // Light colors → darken on hover; dark colors → lighten.
  const hoverBrightness = luminance(bgcolor ?? normalBg) > 0.5 ? 0.8 : 1.2;

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    renderLock.lock();
    setMenuPos({ top: e.clientY, left: e.clientX });
  };

  const handleMenuClose = () => {
    setMenuPos(null);
    renderLock.unlock();
  };

  const fireAction = (action: 'edit' | 'add-before' | 'add-after') => {
    handleMenuClose();
    onMenuAction?.(action);
  };

  const menu: DropDownMenuConfig = {
    title: passing.checkpoint,
    items: [
      { icon: <EditIcon fontSize="small" color="primary" />, text: 'Edit passing', action: () => fireAction('edit') },
      enabled
        ? { icon: <DisabledByDefaultIcon fontSize="small" color="error" />, text: 'Disable', action: toggleEnabled }
        : { icon: <CheckCircleIcon fontSize="small" color="success" />, text: 'Enable', action: toggleEnabled },
      { icon: <FirstPageIcon fontSize="small" color="primary" />, text: 'Add before', action: () => fireAction('add-before') },
      { icon: <LastPageIcon fontSize="small" color="primary" />, text: 'Add after', action: () => fireAction('add-after') },
    ],
  };

  return (
    <>
      <Box
        onDoubleClick={() => onMenuAction?.('edit')}
        onContextMenu={handleContextMenu}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          px: 1,
          py: 0.5,
          borderRadius: 1,
          bgcolor: bgcolor ?? (enabled ? 'primary.main' : (theme.palette.mode === 'dark' ? 'grey.700' : 'grey.300')),
          color: enabled ? 'primary.contrastText' : 'text.secondary',
          minWidth: 72,
          height: '100%',
          cursor: 'default',
          userSelect: 'none',
          flexShrink: 0,
          filter: menuPos ? `brightness(${hoverBrightness})` : 'none',
          '&:hover': {
            filter: `brightness(${hoverBrightness})`,
          },
        }}
      >
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

      <DropDownMenu
        open={menuPos !== null}
        onClose={handleMenuClose}
        menu={menu}
        anchorPosition={menuPos ?? undefined}
        width={180}
      />
    </>
  );
}
