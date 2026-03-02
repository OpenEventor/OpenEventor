import { useState, type MouseEvent } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import type { MonitorCompetitor } from './useMonitorStore';
import DropDownMenu from '../../../components/DropDownMenu/DropDownMenu';
import type { DropDownMenuConfig } from '../../../components/DropDownMenu/types';

export type ParticipantStatus = 'error' | 'ok' | 'in-progress';
export type ParticipantHighlight = 'bib' | 'name' | 'distance' | 'group';

interface ParticipantHeaderProps {
  competitor: MonitorCompetitor | null;
  cards: string[];
  courseName: string;
  groupName: string;
  status?: ParticipantStatus;
  highlight?: ParticipantHighlight;
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

function statusBorderColor(status: ParticipantStatus | undefined): string | undefined {
  switch (status) {
    case 'error': return 'error.main';
    case 'ok': return 'success.main';
    case 'in-progress': return 'grey.500';
    default: return undefined;
  }
}

function formatStartTime(startTime: string): string {
  if (!startTime) return '';
  try {
    const d = new Date(startTime);
    if (isNaN(d.getTime())) return startTime;
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  } catch {
    return startTime;
  }
}

/** Returns the highest-priority status flag label, or null. Priority: DSQ > DNF > DNS. */
function getStatusFlag(competitor: MonitorCompetitor): string | null {
  if (competitor.dsq) return 'DSQ';
  if (competitor.dnf) return 'DNF';
  if (competitor.dns) return 'DNS';
  return null;
}

export default function ParticipantHeader({
  competitor,
  cards,
  courseName,
  groupName,
  status,
  highlight,
  onShowCompetitor,
}: ParticipantHeaderProps) {
  const theme = useTheme();
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const handleContextMenu = (e: MouseEvent) => {
    if (!competitor) return;
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ top: e.clientY, left: e.clientX });
  };

  const menu: DropDownMenuConfig | null = competitor ? {
    title: `#${competitor.bib}`,
    items: [
      { icon: <PersonIcon fontSize="small" />, text: 'Show competitor', action: () => { setMenuPos(null); onShowCompetitor?.(); } },
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
          width: 150,
          minWidth: 150,
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
              {competitor.startTime && (
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
                  {formatStartTime(competitor.startTime)}
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
