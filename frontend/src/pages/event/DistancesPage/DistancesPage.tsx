import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  IconButton,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  DeleteOutlined as DeleteIcon,
  Search as SearchIcon,
  MoreHoriz as MoreHorizIcon,
} from '@mui/icons-material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import DropDownMenu from '../../../components/DropDownMenu/DropDownMenu.tsx';
import DropDownMenuPrompt from '../../../components/DropDownMenu/DropDownMenuPrompt.tsx';
import type { DropDownMenuConfig } from '../../../components/DropDownMenu/types.ts';
import { api } from '../../../api/client.ts';
import type { Course } from '../../../api/types.ts';
import { CourseDialog } from './CourseDialog.tsx';

export function DistancesPage() {
  const { t } = useTranslation();
  const { eventId } = useParams<{ eventId: string }>();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  const [rowMenuAnchor, setRowMenuAnchor] = useState<HTMLElement | null>(null);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Course | null>(null);

  const fetchData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Course[]>(`/api/events/${eventId}/courses`);
      setCourses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('courses.loadError'));
    } finally {
      setLoading(false);
    }
  }, [eventId, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (!searchText.trim()) return courses;
    const q = searchText.toLowerCase();
    return courses.filter((c) =>
      [c.name, c.description].some((v) => v && v.toLowerCase().includes(q)),
    );
  }, [courses, searchText]);

  const actionsColumn: GridColDef = useMemo(() => ({
    field: 'actions', headerName: '', width: 50, sortable: false, disableColumnMenu: true,
    renderCell: (params) => (
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setRowMenuAnchor(e.currentTarget); setRowMenuId(params.row.id); }}>
        <MoreHorizIcon fontSize="small" />
      </IconButton>
    ),
  }), []);

  const columns = useMemo<GridColDef[]>(() => [
    { field: 'name', headerName: t('common.name'), flex: 1, minWidth: 150 },
    {
      field: 'checkpoints', headerName: t('courses.columns.checkpoints'), width: 200,
      valueFormatter: (value: string) => {
        if (!value) return '—';
        try {
          const arr = JSON.parse(value);
          return Array.isArray(arr) ? arr.join(' → ') : value;
        } catch { return value; }
      },
    },
    {
      field: 'validationMode', headerName: t('courses.columns.validation'), width: 100,
      valueFormatter: (value: string) =>
        value === 'relaxed' ? t('courses.dialog.relaxed')
          : value === 'strict' ? t('courses.dialog.strict')
            : (value || '—'),
    },
    { field: 'length', headerName: t('courses.columns.length'), width: 100, type: 'number' },
    { field: 'climb', headerName: t('courses.columns.climb'), width: 100, type: 'number' },
    { field: 'price', headerName: t('courses.columns.price'), width: 80, type: 'number' },
    actionsColumn,
  ], [actionsColumn, t]);

  const handleRowMenuClose = () => { setRowMenuAnchor(null); setRowMenuId(null); };

  const handleEdit = () => {
    const item = courses.find((c) => c.id === rowMenuId);
    if (item) { setEditingItem(item); setDialogOpen(true); }
    handleRowMenuClose();
  };

  const handleDelete = async () => {
    if (!eventId || !rowMenuId) return;
    try {
      await api.del(`/api/events/${eventId}/courses/${rowMenuId}`);
      handleRowMenuClose();
      fetchData();
    } catch { /* noop */ }
  };

  const menuItem = courses.find((c) => c.id === rowMenuId);

  const rowMenu: DropDownMenuConfig = useMemo(() => ({
    items: [
      { icon: <EditIcon />, text: t('common.edit'), action: handleEdit },
      {
        icon: <DeleteIcon />, text: t('common.delete'),
        nested: {
          title: t('courses.deleteTitle'),
          items: [{
            Component: (
              <DropDownMenuPrompt
                label={t('common.typeToConfirm', { name: menuItem?.name ?? '' })}
                placeholder={t('courses.namePlaceholder')}
                confirmBtnProps={{ text: t('common.delete'), color: 'error', onClick: (v: string) => { if (v === (menuItem?.name ?? '')) handleDelete(); } }}
                cancelBtnProps={{ show: true, text: t('common.cancel'), onClick: handleRowMenuClose }}
              />
            ),
          }],
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [menuItem?.id, menuItem?.name, rowMenuId, t]);

  const handleSaved = () => { setDialogOpen(false); setEditingItem(null); fetchData(); };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, flexWrap: 'wrap' }}>
        <TextField
          size="small" variant="outlined" placeholder={t('common.searchPlaceholder')}
          value={searchText} onChange={(e) => setSearchText(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment> } }}
          sx={{ width: 220 }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" size="small" startIcon={<AddIcon />} sx={{ height: 40 }} onClick={() => { setEditingItem(null); setDialogOpen(true); }}>
          {t('common.addNew')}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1 }} action={<Button onClick={fetchData}>{t('common.retry')}</Button>}>{error}</Alert>}

      <DropDownMenu open={Boolean(rowMenuAnchor)} onClose={handleRowMenuClose} menu={rowMenu} anchorEl={rowMenuAnchor} width={220} />
      <CourseDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditingItem(null); }} onSaved={handleSaved} eventId={eventId || ''} course={editingItem} />

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          rows={filtered} columns={columns} loading={loading}
          disableColumnMenu disableRowSelectionOnClick
          onRowClick={(params) => { setEditingItem(params.row as Course); setDialogOpen(true); }}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[25, 50, 100]}
          sx={{ height: '100%', cursor: 'pointer' }}
        />
      </Box>
    </Box>
  );
}
