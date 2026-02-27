import { useCallback, useEffect, useMemo, useState } from 'react';
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
  DeleteOutline as DeleteIcon,
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

const COLUMNS: GridColDef[] = [
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
  {
    field: 'checkpoints', headerName: 'Checkpoints', width: 200,
    valueFormatter: (value: string) => {
      if (!value) return '—';
      try {
        const arr = JSON.parse(value);
        return Array.isArray(arr) ? arr.join(' → ') : value;
      } catch { return value; }
    },
  },
  { field: 'validationMode', headerName: 'Validation', width: 100 },
  { field: 'length', headerName: 'Length (m)', width: 100, type: 'number' },
  { field: 'climb', headerName: 'Climb (m)', width: 100, type: 'number' },
  { field: 'price', headerName: 'Price', width: 80, type: 'number' },
];

export function DistancesPage() {
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
      setError(err instanceof Error ? err.message : 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

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

  const columns = useMemo(() => [...COLUMNS, actionsColumn], [actionsColumn]);

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
      { icon: <EditIcon />, text: 'Edit', action: handleEdit },
      {
        icon: <DeleteIcon />, text: 'Delete',
        nested: {
          title: 'Delete course',
          items: [{
            Component: (
              <DropDownMenuPrompt
                label={`Type "${menuItem?.name ?? ''}" to confirm`}
                placeholder="Course name"
                confirmBtnProps={{ text: 'Delete', color: 'error', onClick: (v: string) => { if (v === (menuItem?.name ?? '')) handleDelete(); } }}
                cancelBtnProps={{ show: true, text: 'Cancel', onClick: handleRowMenuClose }}
              />
            ),
          }],
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [menuItem?.id, menuItem?.name, rowMenuId]);

  const handleSaved = () => { setDialogOpen(false); setEditingItem(null); fetchData(); };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, flexWrap: 'wrap' }}>
        <TextField
          size="small" variant="outlined" placeholder="Search..."
          value={searchText} onChange={(e) => setSearchText(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment> } }}
          sx={{ width: 220 }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" size="small" startIcon={<AddIcon />} sx={{ height: 40 }} onClick={() => { setEditingItem(null); setDialogOpen(true); }}>
          Add new
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1 }} action={<Button onClick={fetchData}>Retry</Button>}>{error}</Alert>}

      <DropDownMenu open={Boolean(rowMenuAnchor)} onClose={handleRowMenuClose} menu={rowMenu} anchorEl={rowMenuAnchor} width={220} />
      <CourseDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditingItem(null); }} onSaved={handleSaved} eventId={eventId || ''} course={editingItem} />

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          rows={filtered} columns={columns} loading={loading}
          disableColumnMenu disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[25, 50, 100]}
          sx={{ height: '100%' }}
        />
      </Box>
    </Box>
  );
}
