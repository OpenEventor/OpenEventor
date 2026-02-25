import { Outlet } from 'react-router-dom';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { BottomNav } from '../BottomNav/BottomNav.tsx';

export function EventLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <>
      <Box sx={{ pb: isMobile ? 7 : 0 }}>
        <Outlet />
      </Box>
      {isMobile && <BottomNav />}
    </>
  );
}
