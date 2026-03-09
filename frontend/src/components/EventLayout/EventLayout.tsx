import { Outlet } from 'react-router-dom';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { BottomNav } from '../BottomNav/BottomNav.tsx';
import { AppBar } from '../AppBar/AppBar.tsx';
import { EventProvider } from '../../contexts/EventContext.tsx';

export function EventLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <EventProvider>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <AppBar />
        <Box component="main" sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', p: 2, pb: isMobile ? 7 : 2 }}>
          <Outlet />
        </Box>
        {isMobile && <BottomNav />}
      </Box>
    </EventProvider>
  );
}
