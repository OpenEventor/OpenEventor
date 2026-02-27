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
import type { Team } from '../../../api/types.ts';
import { TeamDialog } from './TeamDialog.tsx';

const COLUMNS: GridColDef[] = [
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
  { field: 'country', headerName: 'Country', width: 120 },
  { field: 'region', headerName: 'Region', width: 120 },
  { field: 'city', headerName: 'City', width: 120 },
];

export function TeamsPage() {
  const { eventId } = useParams<{ eventId: string }>();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  const [rowMenuAnchor, setRowMenuAnchor] = useState<HTMLElement | null>(null);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Team | null>(null);

  const fetchData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Team[]>(`/api/events/${eventId}/teams`);
      setTeams(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (!searchText.trim()) return teams;
    const q = searchText.toLowerCase();
    return teams.filter((t) =>
      [t.name, t.country, t.region, t.city].some((v) => v && v.toLowerCase().includes(q)),
    );
  }, [teams, searchText]);

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
    const item = teams.find((t) => t.id === rowMenuId);
    if (item) { setEditingItem(item); setDialogOpen(true); }
    handleRowMenuClose();
  };

  const handleDelete = async () => {
    if (!eventId || !rowMenuId) return;
    try {
      await api.del(`/api/events/${eventId}/teams/${rowMenuId}`);
      handleRowMenuClose();
      fetchData();
    } catch { /* noop */ }
  };

  const menuItem = teams.find((t) => t.id === rowMenuId);

  const rowMenu: DropDownMenuConfig = useMemo(() => ({
    items: [
      { icon: <EditIcon />, text: 'Edit', action: handleEdit },
      {
        icon: <DeleteIcon />, text: 'Delete',
        nested: {
          title: 'Delete team',
          items: [{
            Component: (
              <DropDownMenuPrompt
                label={`Type "${menuItem?.name ?? ''}" to confirm`}
                placeholder="Team name"
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
      <TeamDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditingItem(null); }} onSaved={handleSaved} eventId={eventId || ''} team={editingItem} />

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
