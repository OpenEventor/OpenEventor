import { Outlet, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import { AppBar } from '../AppBar/AppBar.tsx';

// Root layout: AppBar + content for top-level pages (events list, timing).
// Event pages render bare — EventLayout brings its own AppBar + sidebar.
export function RootLayout() {
  const location = useLocation();

  const isEventPage = /^\/events\/[^/]+/.test(location.pathname);
  if (isEventPage) {
    return <Outlet />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppBar />
      <Box component="main" sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', p: 2 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
