import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../../../basePath.ts';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  FormControlLabel,
  IconButton,
  MenuItem,
  Popover,
  TextField,
  InputAdornment,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  DeleteOutlined as DeleteIcon,
  FileUpload as FileUploadIcon,
  Search as SearchIcon,
  FilterAlt as FilterAltIcon,
  MoreHoriz as MoreHorizIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material';
import { DataGrid, type GridColDef, type GridRowSelectionModel } from '@mui/x-data-grid';
import DropDownMenu from '../../../components/DropDownMenu/DropDownMenu.tsx';
import DropDownMenuPrompt from '../../../components/DropDownMenu/DropDownMenuPrompt.tsx';
import Field from '../../../components/Field/Field.tsx';
import type { DropDownMenuConfig } from '../../../components/DropDownMenu/types.ts';
import { useColumnSettings, type ColumnDef } from '../../../hooks/useColumnSettings.ts';
import { ColumnSettingsPanel } from '../../../components/ColumnSettingsPanel/ColumnSettingsPanel.tsx';
import { api } from '../../../api/client.ts';
import type { Competitor, Group, Course, Team } from '../../../api/types.ts';
import { CompetitorDialog } from './CompetitorDialog.tsx';
import Time from '../../../components/Time/Time.tsx';
import { useEvent } from '../../../contexts/EventContext.tsx';
import ImportWizard from '../../../features/ImportWizard/ImportWizard.tsx';
import { COMPETITOR_FIELDS } from '../../../features/ImportWizard/fieldDefinitions.ts';

type TFn = (key: string, options?: Record<string, unknown>) => string;

function buildColumnDefs(t: TFn): ColumnDef[] {
  return [
    { field: 'bib', label: t('competitors.columns.bib') },
    { field: 'lastName', label: t('competitors.columns.lastName') },
    { field: 'firstName', label: t('competitors.columns.firstName') },
    { field: 'middleName', label: t('competitors.columns.middleName'), defaultVisible: false },
    { field: 'lastNameInt', label: t('competitors.columns.lastNameInt'), defaultVisible: false },
    { field: 'firstNameInt', label: t('competitors.columns.firstNameInt'), defaultVisible: false },
    { field: 'card1', label: t('competitors.columns.card1') },
    { field: 'card2', label: t('competitors.columns.card2'), defaultVisible: false },
    { field: 'groupId', label: t('competitors.columns.group'), defaultVisible: false },
    { field: 'courseId', label: t('competitors.columns.course'), defaultVisible: false },
    { field: 'teamId', label: t('competitors.columns.team'), defaultVisible: false },
    { field: 'gender', label: t('competitors.columns.gender'), defaultVisible: false },
    { field: 'birthDate', label: t('competitors.columns.birthDate'), defaultVisible: false },
    { field: 'birthYear', label: t('competitors.columns.birthYear'), defaultVisible: false },
    { field: 'rank', label: t('competitors.columns.rank'), defaultVisible: false },
    { field: 'rating', label: t('competitors.columns.rating'), defaultVisible: false },
    { field: 'country', label: t('competitors.columns.country'), defaultVisible: false },
    { field: 'region', label: t('competitors.columns.region'), defaultVisible: false },
    { field: 'city', label: t('competitors.columns.city'), defaultVisible: false },
    { field: 'phone', label: t('competitors.columns.phone'), defaultVisible: false },
    { field: 'email', label: t('competitors.columns.email'), defaultVisible: false },
    { field: 'startTime', label: t('competitors.columns.startTime'), defaultVisible: false },
    { field: 'timeAdjustment', label: t('competitors.columns.timeAdjustment'), defaultVisible: false },
    { field: 'dsq', label: 'DSQ', defaultVisible: false },
    { field: 'dns', label: 'DNS', defaultVisible: false },
    { field: 'dnf', label: 'DNF', defaultVisible: false },
    { field: 'outOfRank', label: t('competitors.columns.outOfRank'), defaultVisible: false },
    { field: 'entryNumber', label: t('competitors.columns.entryNumber'), defaultVisible: false },
    { field: 'price', label: t('competitors.columns.price'), defaultVisible: false },
    { field: 'isPaid', label: t('competitors.columns.paid'), defaultVisible: false },
    { field: 'isCheckin', label: t('competitors.columns.checkin'), defaultVisible: false },
    { field: 'notes', label: t('common.notes'), defaultVisible: false },
  ];
}

function StartTimeCell({ value }: { value: number }) {
  const { date: baseDate, timezone } = useEvent();
  if (!value || value <= 0) return null;
  return <Time value={value} baseDate={baseDate} timezone={timezone} />;
}

/** id → display-name maps used to resolve relational columns to human labels. */
interface NameLookups {
  groups: Map<string, string>;
  courses: Map<string, string>;
  teams: Map<string, string>;
}

// DSQ/DNF/DNS cell: shows the three-letter code instead of a check/cross — bold
// when the status was set manually on the competitor, muted grey when it was
// computed from course validation (empty when neither). `statuses` maps
// competitorId → computed status ("DSQ"|"DNF"|"DNS"|"OK"|"NC") from /results.
function statusColumn(
  field: 'dsq' | 'dnf' | 'dns',
  letter: string,
  statuses: Map<string, string>,
): GridColDef {
  return {
    field,
    headerName: letter,
    width: 64,
    renderCell: (params) => {
      const manual = params.value === 1;
      const computed = !manual && statuses.get(params.row.id as string) === letter;
      if (!manual && !computed) return '';
      return (
        <Box
          component="span"
          sx={{
            // Both red for visibility; weight alone distinguishes manual vs computed.
            fontWeight: manual ? 700 : 400,
            color: 'error.main',
          }}
        >
          {letter}
        </Box>
      );
    },
  };
}

function buildBaseColumns(t: TFn, lookups: NameLookups, statuses: Map<string, string>): GridColDef[] {
  return [
    { field: 'bib', headerName: t('competitors.columns.bib'), width: 70 },
    { field: 'lastName', headerName: t('competitors.columns.lastName'), flex: 1, minWidth: 120 },
    { field: 'firstName', headerName: t('competitors.columns.firstName'), flex: 1, minWidth: 120 },
    { field: 'middleName', headerName: t('competitors.columns.middleName'), flex: 1, minWidth: 120 },
    { field: 'lastNameInt', headerName: t('competitors.columns.lastNameInt'), flex: 1, minWidth: 120 },
    { field: 'firstNameInt', headerName: t('competitors.columns.firstNameInt'), flex: 1, minWidth: 120 },
    { field: 'card1', headerName: t('competitors.columns.card1'), width: 100 },
    { field: 'card2', headerName: t('competitors.columns.card2'), width: 100 },
    { field: 'groupId', headerName: t('competitors.columns.group'), width: 120, valueGetter: (value) => lookups.groups.get(value as string) ?? '' },
    { field: 'courseId', headerName: t('competitors.columns.course'), width: 120, valueGetter: (value) => lookups.courses.get(value as string) ?? '' },
    { field: 'teamId', headerName: t('competitors.columns.team'), width: 140, valueGetter: (value) => lookups.teams.get(value as string) ?? '' },
    { field: 'gender', headerName: t('competitors.columns.gender'), width: 80 },
    { field: 'birthDate', headerName: t('competitors.columns.birthDate'), width: 110 },
    { field: 'birthYear', headerName: t('competitors.columns.birthYear'), width: 100 },
    { field: 'rank', headerName: t('competitors.columns.rank'), width: 100 },
    { field: 'rating', headerName: t('competitors.columns.rating'), width: 80, type: 'number' },
    { field: 'country', headerName: t('competitors.columns.country'), width: 110 },
    { field: 'region', headerName: t('competitors.columns.region'), width: 110 },
    { field: 'city', headerName: t('competitors.columns.city'), width: 110 },
    { field: 'phone', headerName: t('competitors.columns.phone'), width: 130 },
    { field: 'email', headerName: t('competitors.columns.email'), width: 180 },
    { field: 'startTime', headerName: t('competitors.columns.startTime'), width: 130, renderCell: (params) => <StartTimeCell value={params.value as number} /> },
    { field: 'timeAdjustment', headerName: t('competitors.columns.timeAdjustment'), width: 90, type: 'number' },
    statusColumn('dsq', 'DSQ', statuses),
    statusColumn('dns', 'DNS', statuses),
    statusColumn('dnf', 'DNF', statuses),
    { field: 'outOfRank', headerName: t('competitors.columns.outOfRank'), width: 100, type: 'boolean' },
    { field: 'entryNumber', headerName: t('competitors.columns.entryNumber'), width: 110 },
    { field: 'price', headerName: t('competitors.columns.price'), width: 80, type: 'number' },
    { field: 'isPaid', headerName: t('competitors.columns.paid'), width: 70, type: 'boolean' },
    { field: 'isCheckin', headerName: t('competitors.columns.checkin'), width: 80, type: 'boolean' },
    { field: 'notes', headerName: t('common.notes'), flex: 1, minWidth: 150 },
  ];
}

type StatusFilter = '' | 'ok' | 'dsq' | 'dnf' | 'dns';

interface Filters {
  groupId: string;
  courseId: string;
  teamId: string;
  status: StatusFilter;
  paid: boolean;
  checkin: boolean;
}

const EMPTY_FILTERS: Filters = {
  groupId: '', courseId: '', teamId: '', status: '', paid: false, checkin: false,
};

const STATUS_LABELS: Record<Exclude<StatusFilter, ''>, string> = {
  ok: 'OK', dsq: 'DSQ', dnf: 'DNF', dns: 'DNS',
};

function matchesStatus(c: Competitor, status: StatusFilter): boolean {
  switch (status) {
    case 'ok': return c.dsq !== 1 && c.dns !== 1 && c.dnf !== 1;
    case 'dsq': return c.dsq === 1;
    case 'dnf': return c.dnf === 1;
    case 'dns': return c.dns === 1;
    default: return true;
  }
}

export function CompetitorsPage() {
  const { t } = useTranslation();
  const { eventId, competitorId } = useParams<{ eventId: string; competitorId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // The competitor edit modal has its own URL: .../competitors/:id/edit.
  const isEditRoute = location.pathname.endsWith('/edit');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { settings } = useEvent();

  // Data state
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>({ type: 'include', ids: new Set() });
  const [searchText, setSearchText] = useState('');
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [groups, setGroups] = useState<Group[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  // competitorId → computed status (from on-the-fly /results), for the DSQ/DNF/DNS columns.
  const [statusLookup, setStatusLookup] = useState<Map<string, string>>(new Map());
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);

  // Row action menu state
  const [rowMenuAnchor, setRowMenuAnchor] = useState<HTMLElement | null>(null);
  const [rowMenuCompetitorId, setRowMenuCompetitorId] = useState<string | null>(null);

  // Bulk (selection) action menu state
  const [bulkAnchor, setBulkAnchor] = useState<HTMLElement | null>(null);

  // Competitor dialog state
  const [dialogMode, setDialogMode] = useState<'view' | 'edit' | 'create' | null>(null);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);

  // Import wizard state
  const [importOpen, setImportOpen] = useState(false);

  // Actions column (not managed by column settings)
  const actionsColumn: GridColDef = useMemo(() => ({
    field: 'actions',
    headerName: '',
    width: 50,
    sortable: false,
    disableColumnMenu: true,
    renderCell: (params) => (
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          setRowMenuAnchor(e.currentTarget);
          setRowMenuCompetitorId(params.row.id);
        }}
      >
        <MoreHorizIcon fontSize="small" />
      </IconButton>
    ),
  }), []);

  // id → name maps so relational columns render human labels (and stay
  // sortable/filterable on the resolved name via the DataGrid valueGetter).
  const nameLookups = useMemo<NameLookups>(() => ({
    groups: new Map(groups.map((g) => [g.id, g.name])),
    courses: new Map(courses.map((c) => [c.id, c.name])),
    teams: new Map(teams.map((tm) => [tm.id, tm.name])),
  }), [groups, courses, teams]);

  const columnDefs = useMemo(() => buildColumnDefs(t), [t]);
  const baseColumns = useMemo(() => buildBaseColumns(t, nameLookups, statusLookup), [t, nameLookups, statusLookup]);

  const {
    visibleColumns,
    columnState,
    definitions,
    setColumnVisible,
    moveColumn,
    resetToDefaults,
  } = useColumnSettings('competitors', columnDefs, baseColumns);

  // Append actions column after the managed columns
  const columns = useMemo(
    () => [...visibleColumns, actionsColumn],
    [visibleColumns, actionsColumn],
  );

  // Fetch competitors. `silent` skips the loading overlay — used for background
  // refreshes (e.g. after closing the modal) so the table doesn't flash.
  const fetchCompetitors = useCallback(async (silent = false) => {
    if (!eventId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await api.get<Competitor[]>(`/api/events/${eventId}/competitors`);
      setCompetitors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('competitors.errors.loadFailed'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [eventId, t]);

  useEffect(() => {
    fetchCompetitors();
  }, [fetchCompetitors]);

  // Load groups/courses/teams for the filter panel dropdowns and chip labels.
  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      api.get<Group[]>(`/api/events/${eventId}/groups`),
      api.get<Course[]>(`/api/events/${eventId}/courses`),
      api.get<Team[]>(`/api/events/${eventId}/teams`),
    ])
      .then(([g, c, t]) => { setGroups(g); setCourses(c); setTeams(t); })
      .catch(() => { /* non-critical */ });
  }, [eventId]);

  // Computed statuses for the DSQ/DNF/DNS columns. One /results call (results are
  // computed on the fly server-side — cheap, same endpoint the modal/monitor use);
  // refetched whenever the competitor list changes so edits stay reflected.
  useEffect(() => {
    const token = settings?.token;
    if (!eventId || !token) { setStatusLookup(new Map()); return; }
    let cancelled = false;
    fetch(apiUrl(`/api/events/${eventId}/results?token=${encodeURIComponent(token)}`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('results'))))
      .then((data: { results?: { competitorId: string; status: string }[] }) => {
        if (cancelled) return;
        const m = new Map<string, string>();
        for (const r of data.results ?? []) m.set(r.competitorId, r.status);
        setStatusLookup(m);
      })
      .catch(() => { if (!cancelled) setStatusLookup(new Map()); });
    return () => { cancelled = true; };
  }, [eventId, settings?.token, competitors]);

  // Client-side text search + filter panel
  const filteredCompetitors = useMemo(() => {
    let rows = competitors;
    const q = searchText.trim().toLowerCase();
    if (q) {
      rows = rows.filter((c) =>
        [c.lastName, c.firstName, c.middleName, c.bib, c.card1, c.card2, c.city, c.country, c.email, c.phone, c.entryNumber].some(
          (v) => v && v.toLowerCase().includes(q),
        ),
      );
    }
    if (filters.groupId) rows = rows.filter((c) => c.groupId === filters.groupId);
    if (filters.courseId) rows = rows.filter((c) => c.courseId === filters.courseId);
    if (filters.teamId) rows = rows.filter((c) => c.teamId === filters.teamId);
    if (filters.status) rows = rows.filter((c) => matchesStatus(c, filters.status));
    if (filters.paid) rows = rows.filter((c) => c.isPaid === 1);
    if (filters.checkin) rows = rows.filter((c) => c.isCheckin === 1);
    return rows;
  }, [competitors, searchText, filters]);

  // Resolve the current selection to concrete competitor ids. The DataGrid model
  // is either an explicit include-set or an exclude-set (header "select all"),
  // the latter meaning "every visible row except these".
  const selectedIds = useMemo<string[]>(() => {
    if (selectionModel.type === 'exclude') {
      return filteredCompetitors
        .filter((c) => !selectionModel.ids.has(c.id))
        .map((c) => c.id);
    }
    return filteredCompetitors
      .filter((c) => selectionModel.ids.has(c.id))
      .map((c) => c.id);
  }, [selectionModel, filteredCompetitors]);
  const selectedCount = selectedIds.length;

  // Active-filter chips (removable)
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (filters.groupId) {
      chips.push({ key: 'group', label: t('competitors.chips.group', { value: groups.find((g) => g.id === filters.groupId)?.name ?? filters.groupId }), clear: () => setFilters((f) => ({ ...f, groupId: '' })) });
    }
    if (filters.courseId) {
      chips.push({ key: 'course', label: t('competitors.chips.course', { value: courses.find((c) => c.id === filters.courseId)?.name ?? filters.courseId }), clear: () => setFilters((f) => ({ ...f, courseId: '' })) });
    }
    if (filters.teamId) {
      chips.push({ key: 'team', label: t('competitors.chips.team', { value: teams.find((tm) => tm.id === filters.teamId)?.name ?? filters.teamId }), clear: () => setFilters((f) => ({ ...f, teamId: '' })) });
    }
    if (filters.status) {
      chips.push({ key: 'status', label: t('competitors.chips.status', { value: STATUS_LABELS[filters.status] }), clear: () => setFilters((f) => ({ ...f, status: '' })) });
    }
    if (filters.paid) {
      chips.push({ key: 'paid', label: t('competitors.chips.paid'), clear: () => setFilters((f) => ({ ...f, paid: false })) });
    }
    if (filters.checkin) {
      chips.push({ key: 'checkin', label: t('competitors.chips.checkedIn'), clear: () => setFilters((f) => ({ ...f, checkin: false })) });
    }
    return chips;
  }, [filters, groups, courses, teams, t]);

  const hasActiveFilters = activeChips.length > 0;

  // Toolbar more menu
  const moreMenu: DropDownMenuConfig = useMemo(
    () => ({
      items: [
        {
          icon: <FileUploadIcon />,
          text: t('common.import'),
          action: () => setImportOpen(true),
        },
        {
          icon: <TableChartIcon />,
          text: t('competitors.tableSettings'),
          action: () => setColumnDialogOpen(true),
        },
      ],
    }),
    [t],
  );

  // Row action menu handlers
  const handleRowMenuClose = () => {
    setRowMenuAnchor(null);
    setRowMenuCompetitorId(null);
  };

  const handleEdit = () => {
    if (rowMenuCompetitorId) {
      navigate(`/events/${eventId}/competitors/${rowMenuCompetitorId}/edit`);
    }
    handleRowMenuClose();
  };

  const handleDelete = async () => {
    if (!eventId || !rowMenuCompetitorId) return;
    try {
      await api.del(`/api/events/${eventId}/competitors/${rowMenuCompetitorId}`);
      handleRowMenuClose();
      fetchCompetitors();
    } catch {
      // silently fail, menu stays open
    }
  };

  const handleBulkDelete = async () => {
    if (!eventId || selectedIds.length === 0) return;
    setBulkAnchor(null);
    // Best-effort: delete each selected competitor, then refresh once.
    await Promise.allSettled(
      selectedIds.map((id) => api.del(`/api/events/${eventId}/competitors/${id}`)),
    );
    setSelectionModel({ type: 'include', ids: new Set() });
    fetchCompetitors();
  };

  const handleDialogClose = () => {
    // Closing the edit modal (any way — save, cancel, backdrop) drops back to the
    // view modal so the just-saved data can be checked, rather than the table.
    if (isEditRoute && competitorId) {
      navigate(`/events/${eventId}/competitors/${competitorId}`, { replace: true });
      return;
    }
    setDialogMode(null);
    setSelectedCompetitor(null);
    // Refresh the table on close: in-modal changes (status switches, split edits,
    // an edit-save) must land in the row. Silent so it doesn't flash the grid.
    fetchCompetitors(true);
    // Clear the deep-link param so the URL reflects the closed modal.
    if (competitorId) navigate(`/events/${eventId}/competitors`, { replace: true });
  };

  const handleDialogSaved = () => {
    // The table refresh happens on close (handleDialogClose); after an edit-save we
    // drop back to the view modal, and the grid is re-read when that finally closes.
    handleDialogClose();
  };

  const handleAddNew = () => {
    setSelectedCompetitor(null);
    setDialogMode('create');
  };

  // Deep-link: /events/:id/competitors/:competitorId opens that competitor's view
  // modal (e.g. from «Разбор проблем»); the trailing /edit segment opens the edit
  // modal. The dialog re-fetches by id in both modes.
  useEffect(() => {
    if (competitorId) {
      setSelectedCompetitor({ id: competitorId } as Competitor);
      setDialogMode(isEditRoute ? 'edit' : 'view');
    }
  }, [competitorId, isEditRoute]);

  const menuCompetitor = competitors.find((c) => c.id === rowMenuCompetitorId);

  const rowMenu: DropDownMenuConfig = useMemo(
    () => ({
      items: [
        {
          icon: <EditIcon />,
          text: t('common.edit'),
          action: handleEdit,
        },
        {
          icon: <DeleteIcon />,
          text: t('common.delete'),
          nested: {
            title: t('competitors.deleteTitle'),
            items: [
              {
                Component: (
                  <DropDownMenuPrompt
                    label={t('competitors.confirmDelete.label', { name: menuCompetitor ? `${menuCompetitor.lastName} ${menuCompetitor.firstName}`.trim() : '' })}
                    placeholder={t('competitors.confirmDelete.placeholder')}
                    confirmBtnProps={{
                      text: t('common.delete'),
                      color: 'error',
                      onClick: (value: string) => {
                        const expected = menuCompetitor
                          ? `${menuCompetitor.lastName} ${menuCompetitor.firstName}`.trim()
                          : '';
                        if (value === expected) handleDelete();
                      },
                    }}
                    cancelBtnProps={{
                      show: true,
                      text: t('common.cancel'),
                      onClick: handleRowMenuClose,
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
    [menuCompetitor?.id, menuCompetitor?.lastName, menuCompetitor?.firstName, rowMenuCompetitorId, t],
  );

  // Bulk action menu (attached to the "Selected (N)" button): type-to-confirm
  // delete of every selected competitor.
  const bulkMenu: DropDownMenuConfig = useMemo(
    () => ({
      title: t('competitors.bulkDelete.title'),
      items: [
        {
          Component: (
            <DropDownMenuPrompt
              label={t('competitors.bulkDelete.label', { count: selectedCount })}
              placeholder={t('competitors.bulkDelete.placeholder')}
              inputType="number"
              confirmBtnProps={{
                text: t('common.delete'),
                color: 'error',
                onClick: (value: string) => {
                  if (value.trim() === String(selectedCount)) handleBulkDelete();
                },
              }}
              cancelBtnProps={{
                show: true,
                text: t('common.cancel'),
                onClick: () => setBulkAnchor(null),
              }}
            />
          ),
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCount, t],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 1,
          flexWrap: 'wrap',
        }}
      >
        {/* Left group — search & filter */}
        <TextField
          size="small"
          variant="outlined"
          placeholder={t('common.searchPlaceholder')}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            width: isMobile ? '100%' : 220,
            order: isMobile ? 1 : 0,
          }}
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

        {/* Selected (N) — conditional */}
        {selectedCount > 0 && (
          <Button
            variant="outlined"
            size="small"
            color="error"
            sx={{ height: 40 }}
            onClick={(e) => setBulkAnchor(e.currentTarget)}
          >
            {t('competitors.selected', { count: selectedCount })}
          </Button>
        )}
        <DropDownMenu
          open={Boolean(bulkAnchor)}
          onClose={() => setBulkAnchor(null)}
          menu={bulkMenu}
          anchorEl={bulkAnchor}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          width={260}
        />

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Right group — Add new + more menu */}
        <Button variant="contained" size="small" startIcon={<AddIcon />} sx={{ height: 40 }} onClick={handleAddNew}>
          {t('competitors.addNew')}
        </Button>

        <Tooltip title={t('competitors.moreActions')} arrow>
          <IconButton
            onClick={(e) => setMoreAnchor(e.currentTarget)}
            sx={{ width: 40, height: 40, borderRadius: 1, border: 1, borderColor: 'divider' }}
          >
            <MoreHorizIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <DropDownMenu
          open={Boolean(moreAnchor)}
          onClose={() => setMoreAnchor(null)}
          menu={moreMenu}
          anchorEl={moreAnchor}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          width={200}
        />
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
          <Field label={t('competitors.columns.group')}>
            <TextField
              select size="small" fullWidth
              value={filters.groupId}
              onChange={(e) => setFilters((f) => ({ ...f, groupId: e.target.value }))}
            >
              <MenuItem value="">{t('common.all')}</MenuItem>
              {groups.map((g) => (
                <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
              ))}
            </TextField>
          </Field>
          <Field label={t('competitors.columns.course')}>
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
          <Field label={t('competitors.columns.team')}>
            <TextField
              select size="small" fullWidth
              value={filters.teamId}
              onChange={(e) => setFilters((f) => ({ ...f, teamId: e.target.value }))}
            >
              <MenuItem value="">{t('common.all')}</MenuItem>
              {teams.map((tm) => (
                <MenuItem key={tm.id} value={tm.id}>{tm.name}</MenuItem>
              ))}
            </TextField>
          </Field>
          <Field label={t('competitors.filters.status')}>
            <TextField
              select size="small" fullWidth
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as StatusFilter }))}
            >
              <MenuItem value="">{t('competitors.filters.any')}</MenuItem>
              <MenuItem value="ok">OK</MenuItem>
              <MenuItem value="dsq">DSQ</MenuItem>
              <MenuItem value="dnf">DNF</MenuItem>
              <MenuItem value="dns">DNS</MenuItem>
            </TextField>
          </Field>
          <FormControlLabel
            control={<Checkbox size="small" checked={filters.paid} onChange={(_, v) => setFilters((f) => ({ ...f, paid: v }))} />}
            label={t('competitors.filters.paidOnly')}
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={filters.checkin} onChange={(_, v) => setFilters((f) => ({ ...f, checkin: v }))} />}
            label={t('competitors.filters.checkinOnly')}
          />
          <Button size="small" onClick={() => setFilters(EMPTY_FILTERS)} disabled={!hasActiveFilters}>
            {t('competitors.filters.clearAll')}
          </Button>
        </Box>
      </Popover>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pb: 1 }}>
          {activeChips.map((chip) => (
            <Chip key={chip.key} label={chip.label} size="small" onDelete={chip.clear} />
          ))}
          <Chip label={t('competitors.filters.clearAll')} size="small" variant="outlined" onClick={() => setFilters(EMPTY_FILTERS)} />
        </Box>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 1 }} action={<Button onClick={() => fetchCompetitors()}>{t('common.retry')}</Button>}>
          {error}
        </Alert>
      )}

      {/* Column settings dialog */}
      <Dialog
        open={columnDialogOpen}
        onClose={() => setColumnDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
          {t('competitors.tableColumns')}
          <IconButton size="small" onClick={() => setColumnDialogOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <ColumnSettingsPanel
            columnState={columnState}
            definitions={definitions}
            onVisibleChange={setColumnVisible}
            onMove={moveColumn}
            onReset={resetToDefaults}
          />
        </DialogContent>
      </Dialog>

      {/* Row actions menu */}
      <DropDownMenu
        open={Boolean(rowMenuAnchor)}
        onClose={handleRowMenuClose}
        menu={rowMenu}
        anchorEl={rowMenuAnchor}
        width={220}
      />

      {/* Competitor view/edit/create dialog */}
      <CompetitorDialog
        open={dialogMode !== null}
        mode={dialogMode ?? 'view'}
        onClose={handleDialogClose}
        onSaved={handleDialogSaved}
        onEditClick={() =>
          competitorId &&
          navigate(`/events/${eventId}/competitors/${competitorId}/edit`)
        }
        eventId={eventId || ''}
        competitorId={selectedCompetitor?.id}
        competitor={selectedCompetitor}
      />

      {/* Import wizard */}
      <ImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onComplete={() => fetchCompetitors()}
        entityName="competitors"
        fields={COMPETITOR_FIELDS}
        parseUrl={`/api/events/${eventId}/import/parse`}
        importUrl={`/api/events/${eventId}/import/execute`}
      />

      {/* DataGrid */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          rows={filteredCompetitors}
          columns={columns}
          loading={loading}
          checkboxSelection
          disableColumnMenu
          disableRowSelectionOnClick
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={setSelectionModel}
          onRowClick={(params) => navigate(`/events/${eventId}/competitors/${(params.row as Competitor).id}`)}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
          }}
          pageSizeOptions={[25, 50, 100]}
          sx={{ height: '100%', cursor: 'pointer' }}
        />
      </Box>
    </Box>
  );
}
