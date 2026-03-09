import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { AppBar } from '../AppBar/AppBar.tsx';

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if we're on an event page — EventLayout handles its own AppBar + layout
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
