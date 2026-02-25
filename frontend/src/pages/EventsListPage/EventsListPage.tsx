import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreHoriz as MoreHorizIcon,
  Download as DownloadIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import DropDownMenu from '../../components/DropDownMenu/DropDownMenu.tsx';
import DropDownMenuPrompt from '../../components/DropDownMenu/DropDownMenuPrompt.tsx';
import type { DropDownMenuConfig } from '../../components/DropDownMenu/types.ts';
import { api } from '../../api/client.ts';
import type { EventItem } from '../../api/types.ts';
import { CreateEventDialog } from './CreateEventDialog.tsx';

export function EventsListPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuEventId, setMenuEventId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<EventItem[]>('/api/events');
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleCreated = () => {
    setCreateOpen(false);
    fetchEvents();
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, eventId: string) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuEventId(eventId);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuEventId(null);
  };

  const handleDelete = async (value: string) => {
    const event = events.find((ev) => ev.id === menuEventId);
    if (!event || value !== event.displayName) return;
    try {
      await api.del(`/api/events/${menuEventId}`);
      handleMenuClose();
      fetchEvents();
    } catch {
      // error is handled silently; menu stays open
    }
  };

  const menuEvent = events.find((ev) => ev.id === menuEventId);

  const menu: DropDownMenuConfig = useMemo(
    () => ({
      items: [
        {
          icon: <DownloadIcon />,
          text: 'Download',
          disabled: true,
        },
        {
          icon: <DeleteIcon />,
          text: 'Delete event',
          nested: {
            title: 'Delete event',
            items: [
              {
                Component: (
                  <DropDownMenuPrompt
                    label={`Type "${menuEvent?.displayName}" to confirm`}
                    placeholder="Event name"
                    confirmBtnProps={{
                      text: 'Delete',
                      color: 'error',
                      onClick: handleDelete,
                    }}
                    cancelBtnProps={{
                      show: true,
                      text: 'Cancel',
                      onClick: handleMenuClose,
                    }}
                  />
                ),
              },
            ],
          },
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [menuEvent?.displayName, menuEventId],
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Events</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Create Event
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={fetchEvents}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {!loading && !error && events.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            No events yet. Create your first event to get started.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Create Event
          </Button>
        </Paper>
      )}

      {(loading || events.length > 0) && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right" sx={{ width: 60 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton width={100} /></TableCell>
                      <TableCell><Skeleton width={80} /></TableCell>
                      <TableCell><Skeleton width={28} /></TableCell>
                    </TableRow>
                  ))
                : events.map((event) => (
                    <TableRow
                      key={event.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/events/${event.id}/competitors`)}
                    >
                      <TableCell>{event.displayName}</TableCell>
                      <TableCell>{event.date || '—'}</TableCell>
                      <TableCell>{event.createdAt ? new Date(event.createdAt).toLocaleDateString() : '—'}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={(e) => handleMenuOpen(e, event.id)}>
                          <MoreHorizIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <DropDownMenu
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        menu={menu}
        anchorEl={menuAnchor}
        width={240}
      />

      <CreateEventDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </Box>
  );
}
