import { useState, type MouseEvent } from 'react';
import { Box, Typography } from '@mui/material';
import type { Passing } from '../../../api/types';
import DropDownMenu from '../../../components/DropDownMenu/DropDownMenu';
import type { DropDownMenuConfig } from '../../../components/DropDownMenu/types';

interface PassingBlockProps {
  passing: Passing;
  /** Delta in seconds from previous enabled passing (null if first). */
  delta: number | null;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const cs = String(Math.round((timestamp % 1) * 100)).padStart(2, '0');
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

export default function PassingBlock({ passing, delta }: PassingBlockProps) {
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const enabled = passing.enabled === 1;

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ top: e.clientY, left: e.clientX });
  };

  const menu: DropDownMenuConfig = {
    title: passing.checkpoint,
    items: [
      { text: 'Edit time', action: () => { /* placeholder */ } },
      { text: enabled ? 'Disable' : 'Enable', action: () => { /* placeholder */ } },
      { text: 'Change checkpoint', action: () => { /* placeholder */ } },
    ],
  };

  return (
    <>
      <Box
        onContextMenu={handleContextMenu}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 1,
          py: 0.5,
          borderRadius: 1,
          bgcolor: enabled ? 'primary.main' : 'grey.400',
          color: enabled ? 'primary.contrastText' : 'text.secondary',
          minWidth: 72,
          height: '100%',
          cursor: 'context-menu',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {passing.checkpoint}
        </Typography>
        <Typography variant="caption" sx={{ lineHeight: 1.2, opacity: 0.9 }}>
          {formatTime(passing.timestamp)}
        </Typography>
        {delta !== null && (
          <Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1, opacity: 0.7 }}>
            {formatDelta(delta)}
          </Typography>
        )}
      </Box>

      <DropDownMenu
        open={menuPos !== null}
        onClose={() => setMenuPos(null)}
        menu={menu}
        anchorPosition={menuPos ?? undefined}
        width={180}
      />
    </>
  );
}
