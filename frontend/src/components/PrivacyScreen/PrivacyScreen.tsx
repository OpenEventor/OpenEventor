import { Box, Typography } from '@mui/material';
import logoSvg from '../../assets/logo.svg';

interface PrivacyScreenProps {
  open: boolean;
  onClose: () => void;
}

export function PrivacyScreen({ open, onClose }: PrivacyScreenProps) {
  if (!open) return null;

  return (
    <Box
      onClick={onClose}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        bgcolor: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <Box
        component="img"
        src={logoSvg}
        alt="OpenEventor"
        sx={{ width: 80, height: 80, mb: 2 }}
      />
      <Typography
        variant="h5"
        sx={{ color: '#fff', fontWeight: 500, mb: 6 }}
      >
        OpenEventor
      </Typography>
      <Typography
        variant="h3"
        sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 300 }}
      >
        Nothing interesting here. Thank you.
      </Typography>
    </Box>
  );
}
