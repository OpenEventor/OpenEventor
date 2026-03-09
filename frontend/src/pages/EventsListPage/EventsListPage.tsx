import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreHoriz as MoreHorizIcon,
  Download as DownloadIcon,
  DeleteOutline as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
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

  const [reloading, setReloading] = useState(false);
  const handleReload = useCallback(async () => {
    setReloading(true);
    try {
      await api.post('/api/events/reload');
      await fetchEvents();
    } catch {
      // silently ignore
    } finally {
      setReloading(false);
    }
  }, [fetchEvents]);

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

  const columns: GridColDef[] = useMemo(
    () => [
      { field: 'displayName', headerName: 'Name', flex: 1, minWidth: 200 },
      { field: 'date', headerName: 'Date', width: 120, valueFormatter: (value: string) => value ? value.split('-').reverse().join('.') : '—' },
      {
        field: 'createdAt',
        headerName: 'Created',
        width: 120,
        valueFormatter: (value: string) => value ? value.slice(0, 10).split('-').reverse().join('.') : '—',
      },
      {
        field: 'actions',
        headerName: '',
        width: 60,
        sortable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setMenuAnchor(e.currentTarget);
              setMenuEventId(params.row.id);
            }}
          >
            <MoreHorizIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [],
  );

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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Events</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleReload}
            disabled={reloading}
          >
            {reloading ? 'Reloading...' : 'Reload databases'}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Create event
          </Button>
        </Box>
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
            Create event
          </Button>
        </Paper>
      )}

      {(loading || events.length > 0) && (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <DataGrid
            rows={events}
            columns={columns}
            loading={loading}
            disableRowSelectionOnClick
            disableColumnMenu
            onRowClick={(params) => navigate(`/events/${params.row.id}/competitors`)}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
            }}
            pageSizeOptions={[25, 50, 100]}
            sx={{
              height: '100%',
              '& .MuiDataGrid-row': { cursor: 'pointer' },
            }}
          />
        </Box>
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
