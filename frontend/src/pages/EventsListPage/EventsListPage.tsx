import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
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
  Upload as UploadIcon,
  MoreHoriz as MoreHorizIcon,
  Download as DownloadIcon,
  DeleteOutlined as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import DropDownMenu from '../../components/DropDownMenu/DropDownMenu.tsx';
import DropDownMenuPrompt from '../../components/DropDownMenu/DropDownMenuPrompt.tsx';
import type { DropDownMenuConfig } from '../../components/DropDownMenu/types.ts';
import { api, getStoredToken } from '../../api/client.ts';
import type { EventItem } from '../../api/types.ts';
import { CreateEventDialog } from './CreateEventDialog.tsx';

export function EventsListPage() {
  const { t } = useTranslation();
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
      setError(err instanceof Error ? err.message : t('events.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset the input so the same file can be re-picked after this run.
      e.target.value = '';
      if (!file) return;
      setImporting(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const event = await api.upload<EventItem>('/api/events/import', formData);
        await fetchEvents();
        navigate(`/events/${event.id}/competitors`);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('events.errors.import'));
      } finally {
        setImporting(false);
      }
    },
    [fetchEvents, navigate, t],
  );

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuEventId(null);
  };

  const handleDownload = useCallback(async (id: string) => {
    try {
      const token = getStoredToken();
      const response = await fetch(`/api/events/${id}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error(t('events.errors.export'));

      // Prefer the server-provided filename, else fall back to event_<id>.db.
      let filename = `event_${id}.db`;
      const disposition = response.headers.get('Content-Disposition');
      const match = disposition && /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
      if (match?.[1]) filename = decodeURIComponent(match[1]);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('events.errors.export'));
    }
  }, [t]);

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
      { field: 'displayName', headerName: t('common.name'), flex: 1, minWidth: 200 },
      { field: 'date', headerName: t('common.date'), width: 120, valueFormatter: (value: string) => value ? value.split('-').reverse().join('.') : '—' },
      {
        field: 'createdAt',
        headerName: t('events.columns.created'),
        width: 120,
        valueFormatter: (value?: string) => (value ? dayjs(value).format('DD.MM.YYYY') : '—'),
      },
      {
        field: 'modifiedAt',
        headerName: t('events.columns.modified'),
        width: 150,
        valueFormatter: (value?: string) => (value ? dayjs(value).format('DD.MM.YYYY HH:mm') : '—'),
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
    [t],
  );

  const menu: DropDownMenuConfig = useMemo(
    () => ({
      items: [
        {
          icon: <DownloadIcon />,
          text: t('common.download'),
          action: () => {
            if (menuEventId) handleDownload(menuEventId);
          },
        },
        {
          icon: <DeleteIcon />,
          text: t('events.deleteEvent'),
          nested: {
            title: t('events.deleteEvent'),
            items: [
              {
                Component: (
                  <DropDownMenuPrompt
                    label={t('events.deleteConfirmLabel', { name: menuEvent?.displayName })}
                    placeholder={t('events.eventName')}
                    confirmBtnProps={{
                      text: t('common.delete'),
                      color: 'error',
                      onClick: handleDelete,
                    }}
                    cancelBtnProps={{
                      show: true,
                      text: t('common.cancel'),
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
    [menuEvent?.displayName, menuEventId, t],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">{t('events.title')}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleReload}
            disabled={reloading}
          >
            {reloading ? t('events.reloading') : t('events.reloadDatabases')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={handleImportClick}
            disabled={importing}
          >
            {importing ? t('events.importing') : t('events.importEvent')}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            {t('events.createEvent')}
          </Button>
        </Box>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={fetchEvents}>{t('common.retry')}</Button>}>
          {error}
        </Alert>
      )}
      {!loading && !error && events.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography
            sx={{
              color: "text.secondary",
              mb: 2
            }}>
            {t('events.empty')}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            {t('events.createEvent')}
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".db,.sqlite,application/octet-stream"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />
    </Box>
  );
}
