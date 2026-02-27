import { Box } from '@mui/material';
import type { ParticipantGroup } from './useMonitorStore';
import ParticipantHeader from './ParticipantHeader';
import PassingBlock from './PassingBlock';
import GapIndicator from './GapIndicator';

interface ParticipantRowProps {
  group: ParticipantGroup;
  height: number;
}

export default function ParticipantRow({ group, height }: ParticipantRowProps) {
  // Compute deltas: time difference from previous enabled passing.
  const deltas: (number | null)[] = [];
  let prevEnabledTimestamp: number | null = null;

  for (const p of group.passings) {
    if (p.enabled === 1 && prevEnabledTimestamp !== null) {
      deltas.push(p.timestamp - prevEnabledTimestamp);
    } else {
      deltas.push(null);
    }
    if (p.enabled === 1) {
      prevEnabledTimestamp = p.timestamp;
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        height,
        borderBottom: 1,
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <ParticipantHeader competitor={group.competitor} cards={group.cards} />

      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          py: 0.25,
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'action.disabled', borderRadius: 2 },
        }}
      >
        <GapIndicator />
        {group.passings.map((p, i) => (
          <Box key={p.id} sx={{ display: 'flex', alignItems: 'stretch' }}>
            <PassingBlock passing={p} delta={deltas[i]} />
            <GapIndicator />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
