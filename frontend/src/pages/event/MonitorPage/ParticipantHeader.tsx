import { useState, type MouseEvent } from 'react';
import { Box, Typography } from '@mui/material';
import type { MonitorCompetitor } from './useMonitorStore';
import DropDownMenu from '../../../components/DropDownMenu/DropDownMenu';
import type { DropDownMenuConfig } from '../../../components/DropDownMenu/types';

interface ParticipantHeaderProps {
  competitor: MonitorCompetitor | null;
  cards: string[];
}

export default function ParticipantHeader({ competitor, cards }: ParticipantHeaderProps) {
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ top: e.clientY, left: e.clientX });
  };

  const menu: DropDownMenuConfig = {
    title: competitor ? `#${competitor.bib}` : cards[0],
    items: [
      { text: 'Open competitor', action: () => { /* placeholder */ } },
    ],
  };

  return (
    <>
      <Box
        onContextMenu={handleContextMenu}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: 1.5,
          py: 0.5,
          minWidth: 100,
          height: '100%',
          bgcolor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider',
          cursor: 'context-menu',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        {competitor ? (
          <>
            <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {competitor.bib ? `#${competitor.bib}` : '—'}
            </Typography>
            <Typography variant="caption" noWrap sx={{ lineHeight: 1.2, color: 'text.secondary', maxWidth: 120 }}>
              {competitor.lastName} {competitor.firstName}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2, fontFamily: 'monospace' }}>
            {cards[0]}
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
