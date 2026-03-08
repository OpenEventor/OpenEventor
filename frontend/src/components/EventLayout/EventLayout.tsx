import { Outlet } from 'react-router-dom';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { BottomNav } from '../BottomNav/BottomNav.tsx';
import { EventProvider } from '../../contexts/EventContext.tsx';

export function EventLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <EventProvider>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', pb: isMobile ? 7 : 0 }}>
        <Outlet />
      </Box>
      {isMobile && <BottomNav />}
    </EventProvider>
  );
}
