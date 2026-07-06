import { Box } from '@mui/material';
import {
  SettingsInputAntenna as AntennaIcon,
  CellTower as TowerIcon,
} from '@mui/icons-material';
import { timingKindDef } from './timingCatalog.ts';

/** Colored logo tile for a kind (placeholder icons until real vendor logos land). */
export function TimingLogo({ kind, size = 44 }: { kind: string; size?: number }) {
  const tint = timingKindDef(kind)?.tint ?? '#8A8A8A';
  const Icon = kind === 'ostis' ? TowerIcon : AntennaIcon;
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 1.5,
        bgcolor: tint,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon sx={{ fontSize: size * 0.55 }} />
    </Box>
  );
}
