import { Box } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

interface GapIndicatorProps {
  onClick?: () => void;
}

export default function GapIndicator({ onClick }: GapIndicatorProps) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;

  return (
    <Box
      onClick={onClick}
      sx={{
        width: 6,
        height: '100%',
        mx: '2px',
        borderRadius: 0.5,
        flexShrink: 0,
        cursor: 'pointer',
        bgcolor: alpha(primary, 0.3),
        transition: 'background-color 0.15s',
        '&:hover': {
          bgcolor: alpha(primary, 0.6),
        },
      }}
    />
  );
}
