import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import {
  AppBar as MuiAppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { EventProvider, useEvent } from '../../contexts/EventContext.tsx';
import { EventSidebar } from '../EventSidebar/EventSidebar.tsx';

function EventShell() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { displayName } = useEvent();

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <EventSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Slim top bar with hamburger — only on narrow screens (drawer is temporary there). */}
        {isMobile && (
          <MuiAppBar
            position="static"
            elevation={0}
            color="default"
            sx={{
              bgcolor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#f0f1f4',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Toolbar sx={{ gap: 1, minHeight: 50, height: 50 }}>
              <IconButton edge="start" onClick={() => setMobileOpen(true)}>
                <MenuIcon />
              </IconButton>
              <Typography variant="subtitle1" noWrap sx={{ fontWeight: 500 }}>
                {displayName || t('nav.event')}
              </Typography>
            </Toolbar>
          </MuiAppBar>
        )}
        <Box
          component="main"
          sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', p: 2, overflowY: 'auto' }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

export function EventLayout() {
  return (
    <EventProvider>
      <EventShell />
    </EventProvider>
  );
}
