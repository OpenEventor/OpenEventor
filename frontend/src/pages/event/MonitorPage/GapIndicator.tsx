import { Box } from '@mui/material';

interface GapIndicatorProps {
  onClick?: () => void;
}

export default function GapIndicator({ onClick }: GapIndicatorProps) {
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
        transition: 'background-color 0.15s',
        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
    />
  );
}
