import { useState, type MouseEvent } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import type { MonitorCompetitor } from './useMonitorStore';
import DropDownMenu from '../../../components/DropDownMenu/DropDownMenu';
import type { DropDownMenuConfig } from '../../../components/DropDownMenu/types';
import Time from '../../../components/Time/Time';
import { useEvent } from '../../../contexts/EventContext';

export type CompetitorStatus = 'error' | 'ok' | 'in-progress';
export type CompetitorHighlight = 'bib' | 'name' | 'distance' | 'group';

interface CompetitorHeaderProps {
  competitor: MonitorCompetitor | null;
  cards: string[];
  courseName: string;
  groupName: string;
  status?: CompetitorStatus;
  highlight?: CompetitorHighlight;
  onShowCompetitor?: () => void;
}

const HIGHLIGHT_BG = '#ffeb3b';
const HIGHLIGHT_TEXT = '#000';

function highlightSx(active: boolean) {
  if (!active) return {};
  return {
    bgcolor: HIGHLIGHT_BG,
    color: HIGHLIGHT_TEXT,
    borderRadius: 0.5,
    px: 0.3,
    mx: -0.3,
  } as const;
}

function statusBorderColor(status: CompetitorStatus | undefined): string | undefined {
  switch (status) {
    case 'error': return 'error.main';
    case 'ok': return 'success.main';
    case 'in-progress': return 'grey.500';
    default: return undefined;
  }
}


/** Returns the highest-priority status flag label, or null. Priority: DSQ > DNF > DNS. */
function getStatusFlag(competitor: MonitorCompetitor): string | null {
  if (competitor.dsq) return 'DSQ';
  if (competitor.dnf) return 'DNF';
  if (competitor.dns) return 'DNS';
  return null;
}

export default function CompetitorHeader({
  competitor,
  cards,
  courseName,
  groupName,
  status,
  highlight,
  onShowCompetitor,
}: CompetitorHeaderProps) {
  const theme = useTheme();
  const { date: baseDate, timezone } = useEvent();
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const handleContextMenu = (e: MouseEvent) => {
    if (!competitor || !onShowCompetitor) return;
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ top: e.clientY, left: e.clientX });
  };

  const menu: DropDownMenuConfig | null = (competitor && onShowCompetitor) ? {
    title: `#${competitor.bib}`,
    items: [
      { icon: <PersonIcon fontSize="small" />, text: 'Show competitor', action: () => { setMenuPos(null); onShowCompetitor(); } },
    ],
  } : null;

  const borderColor = statusBorderColor(status);

  return (
    <>
      <Box
        onContextMenu={handleContextMenu}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: 1,
          py: 0.25,
          width: 170,
          minWidth: 170,
          height: '100%',
          bgcolor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider',
          borderLeft: borderColor ? 3 : 0,
          borderLeftColor: borderColor ?? 'transparent',
          cursor: 'default',
          userSelect: 'none',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {competitor ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', minWidth: 0 }}>
            {/* Row 1: #bib [DSQ] ... courseName */}
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography
                variant="body2"
                noWrap
                sx={{
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  lineHeight: 1.3,
                  ...highlightSx(highlight === 'bib'),
                }}
              >
                {competitor.bib ? `#${competitor.bib}` : '—'}
              </Typography>
              {getStatusFlag(competitor) && (
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, fontSize: '0.65rem', lineHeight: 1, color: 'error.main' }}
                >
                  {getStatusFlag(competitor)}
                </Typography>
              )}
              <Typography
                variant="caption"
                noWrap
                sx={{
                  ml: 'auto',
                  fontSize: '0.65rem',
                  lineHeight: 1.3,
                  color: 'text.secondary',
                  flexShrink: 0,
                  ...highlightSx(highlight === 'distance'),
                }}
              >
                {courseName}
              </Typography>
            </Box>

            {/* Row 2: lastName ... groupName */}
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography
                variant="body2"
                noWrap
                sx={{
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  lineHeight: 1.3,
                  maxWidth: '50%',
                  ...highlightSx(highlight === 'name'),
                }}
              >
                {competitor.lastName}
              </Typography>
              <Typography
                variant="caption"
                noWrap
                sx={{
                  ml: 'auto',
                  fontSize: '0.65rem',
                  lineHeight: 1.3,
                  color: 'text.secondary',
                  flexShrink: 0,
                  ...highlightSx(highlight === 'group'),
                }}
              >
                {groupName}
              </Typography>
            </Box>

            {/* Row 3: firstName ... startTime */}
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography
                variant="caption"
                noWrap
                sx={{
                  fontSize: '0.75rem',
                  lineHeight: 1.3,
                  color: 'text.secondary',
                  maxWidth: '50%',
                  ...highlightSx(highlight === 'name'),
                }}
              >
                {competitor.firstName}
              </Typography>
              {competitor.startTime > 0 && (
                <Typography
                  variant="caption"
                  noWrap
                  sx={{
                    ml: 'auto',
                    fontSize: '0.6rem',
                    lineHeight: 1.3,
                    color: theme.palette.mode === 'dark' ? 'grey.500' : 'grey.600',
                    fontFamily: 'monospace',
                    flexShrink: 0,
                  }}
                >
                  <Time value={competitor.startTime} baseDate={baseDate} timezone={timezone} />
                </Typography>
              )}
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2, fontFamily: 'monospace' }}>
            {cards[0]}
          </Typography>
        )}
      </Box>

      {menu && (
        <DropDownMenu
          open={menuPos !== null}
          onClose={() => setMenuPos(null)}
          menu={menu}
          anchorPosition={menuPos ?? undefined}
          width={180}
        />
      )}
    </>
  );
}
