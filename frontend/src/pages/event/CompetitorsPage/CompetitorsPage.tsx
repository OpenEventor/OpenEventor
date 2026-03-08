import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
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
  DeleteOutline as DeleteIcon,
  FileUpload as FileUploadIcon,
  FileDownload as FileDownloadIcon,
  Search as SearchIcon,
  FilterAlt as FilterAltIcon,
  MoreHoriz as MoreHorizIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material';
import { DataGrid, type GridColDef, type GridRowSelectionModel } from '@mui/x-data-grid';
import DropDownMenu from '../../../components/DropDownMenu/DropDownMenu.tsx';
import DropDownMenuPrompt from '../../../components/DropDownMenu/DropDownMenuPrompt.tsx';
import type { DropDownMenuConfig } from '../../../components/DropDownMenu/types.ts';
import { useColumnSettings, type ColumnDef } from '../../../hooks/useColumnSettings.ts';
import { ColumnSettingsPanel } from '../../../components/ColumnSettingsPanel/ColumnSettingsPanel.tsx';
import { api } from '../../../api/client.ts';
import type { Competitor } from '../../../api/types.ts';
import { CompetitorDialog } from './CompetitorDialog.tsx';
import { formatTime } from '../../../components/PassingBlock/PassingBlock.tsx';
import ImportWizard from '../../../features/ImportWizard/ImportWizard.tsx';
import { COMPETITOR_FIELDS } from '../../../features/ImportWizard/fieldDefinitions.ts';

const COLUMN_DEFS: ColumnDef[] = [
  { field: 'bib', label: 'Bib' },
  { field: 'lastName', label: 'Last Name' },
  { field: 'firstName', label: 'First Name' },
  { field: 'middleName', label: 'Middle Name', defaultVisible: false },
  { field: 'lastNameInt', label: 'Last Name (Int)', defaultVisible: false },
  { field: 'firstNameInt', label: 'First Name (Int)', defaultVisible: false },
  { field: 'card1', label: 'Card 1' },
  { field: 'card2', label: 'Card 2', defaultVisible: false },
  { field: 'groupId', label: 'Group', defaultVisible: false },
  { field: 'courseId', label: 'Course', defaultVisible: false },
  { field: 'teamId', label: 'Team', defaultVisible: false },
  { field: 'gender', label: 'Gender', defaultVisible: false },
  { field: 'birthDate', label: 'Birth Date', defaultVisible: false },
  { field: 'birthYear', label: 'Birth Year', defaultVisible: false },
  { field: 'rank', label: 'Rank', defaultVisible: false },
  { field: 'rating', label: 'Rating', defaultVisible: false },
  { field: 'country', label: 'Country', defaultVisible: false },
  { field: 'region', label: 'Region', defaultVisible: false },
  { field: 'city', label: 'City', defaultVisible: false },
  { field: 'phone', label: 'Phone', defaultVisible: false },
  { field: 'email', label: 'Email', defaultVisible: false },
  { field: 'startTime', label: 'Start Time', defaultVisible: false },
  { field: 'timeAdjustment', label: 'Time Adj.', defaultVisible: false },
  { field: 'dsq', label: 'DSQ', defaultVisible: false },
  { field: 'dns', label: 'DNS', defaultVisible: false },
  { field: 'dnf', label: 'DNF', defaultVisible: false },
  { field: 'outOfRank', label: 'Out of Rank', defaultVisible: false },
  { field: 'entryNumber', label: 'Entry Number', defaultVisible: false },
  { field: 'price', label: 'Price', defaultVisible: false },
  { field: 'isPaid', label: 'Paid', defaultVisible: false },
  { field: 'isCheckin', label: 'Check-in', defaultVisible: false },
  { field: 'notes', label: 'Notes', defaultVisible: false },
];

const BASE_COLUMNS: GridColDef[] = [
  { field: 'bib', headerName: 'Bib', width: 70 },
  { field: 'lastName', headerName: 'Last Name', flex: 1, minWidth: 120 },
  { field: 'firstName', headerName: 'First Name', flex: 1, minWidth: 120 },
  { field: 'middleName', headerName: 'Middle Name', flex: 1, minWidth: 120 },
  { field: 'lastNameInt', headerName: 'Last Name (Int)', flex: 1, minWidth: 120 },
  { field: 'firstNameInt', headerName: 'First Name (Int)', flex: 1, minWidth: 120 },
  { field: 'card1', headerName: 'Card 1', width: 100 },
  { field: 'card2', headerName: 'Card 2', width: 100 },
  { field: 'groupId', headerName: 'Group', width: 120 },
  { field: 'courseId', headerName: 'Course', width: 120 },
  { field: 'teamId', headerName: 'Team', width: 140 },
  { field: 'gender', headerName: 'Gender', width: 80 },
  { field: 'birthDate', headerName: 'Birth Date', width: 110 },
  { field: 'birthYear', headerName: 'Birth Year', width: 100 },
  { field: 'rank', headerName: 'Rank', width: 100 },
  { field: 'rating', headerName: 'Rating', width: 80, type: 'number' },
  { field: 'country', headerName: 'Country', width: 110 },
  { field: 'region', headerName: 'Region', width: 110 },
  { field: 'city', headerName: 'City', width: 110 },
  { field: 'phone', headerName: 'Phone', width: 130 },
  { field: 'email', headerName: 'Email', width: 180 },
  { field: 'startTime', headerName: 'Start Time', width: 130, valueFormatter: (value: number) => value > 0 ? formatTime(value) : '' },
  { field: 'timeAdjustment', headerName: 'Time Adj.', width: 90, type: 'number' },
  { field: 'dsq', headerName: 'DSQ', width: 60, type: 'boolean' },
  { field: 'dns', headerName: 'DNS', width: 60, type: 'boolean' },
  { field: 'dnf', headerName: 'DNF', width: 60, type: 'boolean' },
  { field: 'outOfRank', headerName: 'Out of Rank', width: 100, type: 'boolean' },
  { field: 'entryNumber', headerName: 'Entry Number', width: 110 },
  { field: 'price', headerName: 'Price', width: 80, type: 'number' },
  { field: 'isPaid', headerName: 'Paid', width: 70, type: 'boolean' },
  { field: 'isCheckin', headerName: 'Check-in', width: 80, type: 'boolean' },
  { field: 'notes', headerName: 'Notes', flex: 1, minWidth: 150 },
];

export function CompetitorsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Data state
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>({ type: 'include', ids: new Set() });
  const [searchText, setSearchText] = useState('');
  const [filterActive, setFilterActive] = useState(false);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);

  // Row action menu state
  const [rowMenuAnchor, setRowMenuAnchor] = useState<HTMLElement | null>(null);
  const [rowMenuCompetitorId, setRowMenuCompetitorId] = useState<string | null>(null);

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

  const {
    visibleColumns,
    columnState,
    definitions,
    setColumnVisible,
    moveColumn,
    resetToDefaults,
  } = useColumnSettings('competitors', COLUMN_DEFS, BASE_COLUMNS);

  // Append actions column after the managed columns
  const columns = useMemo(
    () => [...visibleColumns, actionsColumn],
    [visibleColumns, actionsColumn],
  );

  const selectedCount = selectionModel.type === 'include' ? selectionModel.ids.size : 0;

  // Fetch competitors
  const fetchCompetitors = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Competitor[]>(`/api/events/${eventId}/competitors`);
      setCompetitors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load competitors');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchCompetitors();
  }, [fetchCompetitors]);

  // Client-side text search
  const filteredCompetitors = useMemo(() => {
    if (!searchText.trim()) return competitors;
    const q = searchText.toLowerCase();
    return competitors.filter((c) =>
      [c.lastName, c.firstName, c.middleName, c.bib, c.card1, c.card2, c.city, c.country, c.email, c.phone, c.entryNumber].some(
        (v) => v && v.toLowerCase().includes(q),
      ),
    );
  }, [competitors, searchText]);

  // Toolbar more menu
  const moreMenu: DropDownMenuConfig = useMemo(
    () => ({
      items: [
        {
          icon: <FileUploadIcon />,
          text: 'Import',
          action: () => setImportOpen(true),
        },
        {
          icon: <FileDownloadIcon />,
          text: 'Export',
          action: () => {},
        },
        {
          icon: <TableChartIcon />,
          text: 'Table settings',
          action: () => setColumnDialogOpen(true),
        },
      ],
    }),
    [],
  );

  // Row action menu handlers
  const handleRowMenuClose = () => {
    setRowMenuAnchor(null);
    setRowMenuCompetitorId(null);
  };

  const handleEdit = () => {
    const comp = competitors.find((c) => c.id === rowMenuCompetitorId);
    if (comp) {
      setSelectedCompetitor(comp);
      setDialogMode('edit');
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

  const handleDialogClose = () => {
    setDialogMode(null);
    setSelectedCompetitor(null);
  };

  const handleDialogSaved = () => {
    handleDialogClose();
    fetchCompetitors();
  };

  const handleAddNew = () => {
    setSelectedCompetitor(null);
    setDialogMode('create');
  };

  const menuCompetitor = competitors.find((c) => c.id === rowMenuCompetitorId);

  const rowMenu: DropDownMenuConfig = useMemo(
    () => ({
      items: [
        {
          icon: <EditIcon />,
          text: 'Edit',
          action: handleEdit,
        },
        {
          icon: <DeleteIcon />,
          text: 'Delete',
          nested: {
            title: 'Delete competitor',
            items: [
              {
                Component: (
                  <DropDownMenuPrompt
                    label={`Type "${menuCompetitor ? `${menuCompetitor.lastName} ${menuCompetitor.firstName}`.trim() : ''}" to confirm`}
                    placeholder="Competitor name"
                    confirmBtnProps={{
                      text: 'Delete',
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
                      text: 'Cancel',
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
    [menuCompetitor?.id, menuCompetitor?.lastName, menuCompetitor?.firstName, rowMenuCompetitorId],
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
          placeholder="Search..."
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
        <Tooltip title="Filter" arrow>
          <IconButton
            onClick={() => setFilterActive(!filterActive)}
            sx={{
              width: 40,
              height: 40,
              bgcolor: filterActive ? 'action.selected' : 'transparent',
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
          <Button variant="outlined" size="small" sx={{ height: 40 }}>
            Selected ({selectedCount})
          </Button>
        )}

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Right group — Add new + more menu */}
        <Button variant="contained" size="small" startIcon={<AddIcon />} sx={{ height: 40 }} onClick={handleAddNew}>
          Add new
        </Button>

        <Tooltip title="More actions" arrow>
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

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 1 }} action={<Button onClick={fetchCompetitors}>Retry</Button>}>
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
          Table columns
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
        onEditClick={() => setDialogMode('edit')}
        eventId={eventId || ''}
        competitorId={selectedCompetitor?.id}
        competitor={selectedCompetitor}
      />

      {/* Import wizard */}
      <ImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onComplete={fetchCompetitors}
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
          onRowClick={(params) => {
            setSelectedCompetitor(params.row as Competitor);
            setDialogMode('view');
          }}
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
