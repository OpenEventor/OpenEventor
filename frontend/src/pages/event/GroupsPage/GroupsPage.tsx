import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Popover,
  TextField,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  DeleteOutlined as DeleteIcon,
  Search as SearchIcon,
  FilterAlt as FilterAltIcon,
  MoreHoriz as MoreHorizIcon,
} from '@mui/icons-material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import DropDownMenu from '../../../components/DropDownMenu/DropDownMenu.tsx';
import DropDownMenuPrompt from '../../../components/DropDownMenu/DropDownMenuPrompt.tsx';
import Field from '../../../components/Field/Field.tsx';
import type { DropDownMenuConfig } from '../../../components/DropDownMenu/types.ts';
import { api } from '../../../api/client.ts';
import type { Group, Course } from '../../../api/types.ts';
import { GroupDialog } from './GroupDialog.tsx';

// Resolves a group's scoring course: its own `courseId` if set, otherwise the
// first course found by walking the `parentId` chain (cycle-safe). `inherited`
// flags that the course came from an ancestor rather than the group itself.
function resolveScoringCourseId(
  group: Group,
  groupsById: Map<string, Group>,
): { courseId: string; inherited: boolean } {
  if (group.courseId) return { courseId: group.courseId, inherited: false };
  const seen = new Set<string>();
  let g: Group | undefined = group.parentId ? groupsById.get(group.parentId) : undefined;
  while (g && !seen.has(g.id)) {
    seen.add(g.id);
    if (g.courseId) return { courseId: g.courseId, inherited: true };
    g = g.parentId ? groupsById.get(g.parentId) : undefined;
  }
  return { courseId: '', inherited: false };
}

interface Filters {
  courseId: string;
  parentId: string;
}

const EMPTY_FILTERS: Filters = { courseId: '', parentId: '' };

export function GroupsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { t } = useTranslation();

  const [groups, setGroups] = useState<Group[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const [rowMenuAnchor, setRowMenuAnchor] = useState<HTMLElement | null>(null);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Group | null>(null);

  const fetchData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Group[]>(`/api/events/${eventId}/groups`);
      setGroups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('groups.loadError'));
    } finally {
      setLoading(false);
    }
  }, [eventId, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Courses are needed to resolve the scoring-distance column and the filter.
  useEffect(() => {
    if (!eventId) return;
    api.get<Course[]>(`/api/events/${eventId}/courses`)
      .then(setCourses)
      .catch(() => { /* non-critical */ });
  }, [eventId]);

  const groupsById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const coursesById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  // Groups that are referenced as a parent — the options for the parent filter.
  const parentGroups = useMemo(() => {
    const parentIds = new Set(groups.map((g) => g.parentId).filter(Boolean));
    return groups.filter((g) => parentIds.has(g.id));
  }, [groups]);

  const filtered = useMemo(() => {
    let rows = groups;
    const q = searchText.trim().toLowerCase();
    if (q) {
      rows = rows.filter((g) =>
        [g.name, g.description].some((v) => v && v.toLowerCase().includes(q)),
      );
    }
    if (filters.courseId) {
      rows = rows.filter((g) => resolveScoringCourseId(g, groupsById).courseId === filters.courseId);
    }
    if (filters.parentId) rows = rows.filter((g) => g.parentId === filters.parentId);
    return rows;
  }, [groups, searchText, filters, groupsById]);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (filters.courseId) {
      chips.push({
        key: 'course',
        label: t('groups.chips.course', { value: coursesById.get(filters.courseId)?.name ?? filters.courseId }),
        clear: () => setFilters((f) => ({ ...f, courseId: '' })),
      });
    }
    if (filters.parentId) {
      chips.push({
        key: 'parent',
        label: t('groups.chips.parent', { value: groupsById.get(filters.parentId)?.name ?? filters.parentId }),
        clear: () => setFilters((f) => ({ ...f, parentId: '' })),
      });
    }
    return chips;
  }, [filters, coursesById, groupsById, t]);

  const hasActiveFilters = activeChips.length > 0;

  const actionsColumn: GridColDef = useMemo(() => ({
    field: 'actions', headerName: '', width: 50, sortable: false, disableColumnMenu: true,
    renderCell: (params) => (
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setRowMenuAnchor(e.currentTarget); setRowMenuId(params.row.id); }}>
        <MoreHorizIcon fontSize="small" />
      </IconButton>
    ),
  }), []);

  const baseColumns: GridColDef[] = useMemo(() => [
    { field: 'name', headerName: t('common.name'), flex: 1, minWidth: 120 },
    { field: 'gender', headerName: t('groups.gender'), width: 80 },
    { field: 'yearFrom', headerName: t('groups.yearFrom'), width: 100, type: 'number' },
    { field: 'yearTo', headerName: t('groups.yearTo'), width: 100, type: 'number' },
    {
      field: 'courseId', headerName: t('groups.course'), width: 150,
      // Resolved scoring-course name; inherited-from-parent courses get a "↑ " prefix.
      valueGetter: (_value, row: Group) => {
        const { courseId, inherited } = resolveScoringCourseId(row, groupsById);
        if (!courseId) return '';
        const name = coursesById.get(courseId)?.name ?? courseId;
        return inherited ? `↑ ${name}` : name;
      },
    },
    { field: 'sortOrder', headerName: t('groups.order'), width: 80, type: 'number' },
  ], [t, groupsById, coursesById]);

  const columns = useMemo(() => [...baseColumns, actionsColumn], [baseColumns, actionsColumn]);

  const handleRowMenuClose = () => { setRowMenuAnchor(null); setRowMenuId(null); };

  const handleEdit = () => {
    const item = groups.find((g) => g.id === rowMenuId);
    if (item) { setEditingItem(item); setDialogOpen(true); }
    handleRowMenuClose();
  };

  const handleDelete = async () => {
    if (!eventId || !rowMenuId) return;
    try {
      await api.del(`/api/events/${eventId}/groups/${rowMenuId}`);
      handleRowMenuClose();
      fetchData();
    } catch { /* noop */ }
  };

  const menuItem = groups.find((g) => g.id === rowMenuId);

  const rowMenu: DropDownMenuConfig = useMemo(() => ({
    items: [
      { icon: <EditIcon />, text: t('common.edit'), action: handleEdit },
      {
        icon: <DeleteIcon />, text: t('common.delete'),
        nested: {
          title: t('groups.deleteTitle'),
          items: [{
            Component: (
              <DropDownMenuPrompt
                label={t('groups.deleteConfirmLabel', { name: menuItem?.name ?? '' })}
                placeholder={t('groups.namePlaceholder')}
                confirmBtnProps={{ text: t('common.delete'), color: 'error', onClick: (v: string) => { if (v === (menuItem?.name ?? '')) handleDelete(); } }}
                cancelBtnProps={{ show: true, text: t('common.cancel'), onClick: handleRowMenuClose }}
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
          size="small" variant="outlined" placeholder={t('common.searchPlaceholder')}
          value={searchText} onChange={(e) => setSearchText(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment> } }}
          sx={{ width: 220 }}
        />
        <Tooltip title={t('common.filter')} arrow>
          <IconButton
            onClick={(e) => setFilterAnchor(e.currentTarget)}
            sx={{
              width: 40,
              height: 40,
              bgcolor: (Boolean(filterAnchor) || hasActiveFilters) ? 'action.selected' : 'transparent',
              color: hasActiveFilters ? 'primary.main' : 'inherit',
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <FilterAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" size="small" startIcon={<AddIcon />} sx={{ height: 40 }} onClick={() => { setEditingItem(null); setDialogOpen(true); }}>
          {t('groups.addNew')}
        </Button>
      </Box>

      {/* Filter panel */}
      <Popover
        open={Boolean(filterAnchor)}
        anchorEl={filterAnchor}
        onClose={() => setFilterAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, width: 280, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Field label={t('groups.filters.course')}>
            <TextField
              select size="small" fullWidth
              value={filters.courseId}
              onChange={(e) => setFilters((f) => ({ ...f, courseId: e.target.value }))}
            >
              <MenuItem value="">{t('common.all')}</MenuItem>
              {courses.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>
          </Field>
          <Field label={t('groups.filters.parent')}>
            <TextField
              select size="small" fullWidth
              value={filters.parentId}
              onChange={(e) => setFilters((f) => ({ ...f, parentId: e.target.value }))}
            >
              <MenuItem value="">{t('common.all')}</MenuItem>
              {parentGroups.map((g) => (
                <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
              ))}
            </TextField>
          </Field>
          <Button size="small" onClick={() => setFilters(EMPTY_FILTERS)} disabled={!hasActiveFilters}>
            {t('groups.filters.clearAll')}
          </Button>
        </Box>
      </Popover>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pb: 1 }}>
          {activeChips.map((chip) => (
            <Chip key={chip.key} label={chip.label} size="small" onDelete={chip.clear} />
          ))}
          <Chip label={t('groups.filters.clearAll')} size="small" variant="outlined" onClick={() => setFilters(EMPTY_FILTERS)} />
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 1 }} action={<Button onClick={fetchData}>{t('common.retry')}</Button>}>{error}</Alert>}

      <DropDownMenu open={Boolean(rowMenuAnchor)} onClose={handleRowMenuClose} menu={rowMenu} anchorEl={rowMenuAnchor} width={220} />
      <GroupDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditingItem(null); }} onSaved={handleSaved} eventId={eventId || ''} group={editingItem} />

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          rows={filtered} columns={columns} loading={loading}
          disableColumnMenu disableRowSelectionOnClick
          onRowClick={(params) => { setEditingItem(params.row as Group); setDialogOpen(true); }}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[25, 50, 100]}
          sx={{ height: '100%', cursor: 'pointer' }}
        />
      </Box>
    </Box>
  );
}
