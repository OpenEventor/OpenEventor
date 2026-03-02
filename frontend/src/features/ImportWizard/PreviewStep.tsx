import { useEffect, useMemo } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import type { ImportFieldDef } from '../../api/types';
import NumberSpinner from '../../components/NumberSpinner/NumberSpinner';

const NOT_USED = '__not_used__';

interface PreviewStepProps {
  rows: string[][];
  fields: ImportFieldDef[];
  mapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
  startFromRow: number;
  onStartFromRowChange: (row: number) => void;
  importMode: string;
  onImportModeChange: (mode: string) => void;
  onNext: () => void;
  onBack: () => void;
  storageKey: string;
}

const IMPORT_MODES = [
  { value: 'append', label: 'Append', description: 'Add all rows as new competitors' },
  { value: 'replace_by_bib_ignore', label: 'Update by bib (skip unknown)', description: 'Update existing by bib, skip unknown bibs' },
  { value: 'replace_by_bib_add', label: 'Update by bib (add new)', description: 'Update existing by bib, add unknown as new' },
  { value: 'clear_and_import', label: 'Clear and import', description: 'Delete ALL competitors, then import' },
];

export default function PreviewStep({
  rows,
  fields,
  mapping,
  onMappingChange,
  startFromRow,
  onStartFromRowChange,
  importMode,
  onImportModeChange,
  onNext,
  onBack,
  storageKey,
}: PreviewStepProps) {
  const theme = useTheme();

  const colCount = rows.length > 0 ? rows[0].length : 0;

  const fieldOptions = useMemo(() => {
    return [{ field: NOT_USED, label: 'Not used' }, ...fields];
  }, [fields]);

  // Save mapping to localStorage on change.
  useEffect(() => {
    if (Object.keys(mapping).length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(mapping));
    }
  }, [mapping, storageKey]);

  const setColumnField = (colIdx: number, field: string | null) => {
    const next = { ...mapping };
    if (!field || field === NOT_USED) {
      delete next[String(colIdx)];
    } else {
      // Remove this field from any other column first.
      for (const [key, val] of Object.entries(next)) {
        if (val === field) delete next[key];
      }
      next[String(colIdx)] = field;
    }
    onMappingChange(next);
  };

  const isColMapped = (colIdx: number) => !!mapping[String(colIdx)];
  const disabledBg = theme.palette.action.disabledBackground;

  const mappedCount = Object.keys(mapping).length;

  // Build DataGrid rows: each row gets an id and col_0, col_1, ... fields.
  const gridRows = useMemo(() => {
    return rows.map((row, idx) => {
      const obj: Record<string, string | number | boolean> = { id: idx, _rowNum: idx + 1, _isSkipped: idx < startFromRow };
      for (let c = 0; c < row.length; c++) {
        obj[`col_${c}`] = row[c];
      }
      return obj;
    });
  }, [rows, startFromRow]);

  // Compute column widths based on content (approx 8px per char + 24px padding).
  const colWidths = useMemo(() => {
    const widths: number[] = new Array(colCount).fill(0);
    const sampleRows = rows.slice(0, 100); // sample first 100 rows for performance
    for (const row of sampleRows) {
      for (let c = 0; c < row.length; c++) {
        widths[c] = Math.max(widths[c], row[c].length);
      }
    }
    return widths.map((charLen) => Math.max(80, Math.min(charLen * 8 + 24, 300)));
  }, [rows, colCount]);

  // Build DataGrid columns.
  const gridColumns: GridColDef[] = useMemo(() => {
    const cols: GridColDef[] = [
      {
        field: '_rowNum',
        headerName: '#',
        width: 50,
        sortable: false,
        disableColumnMenu: true,
        cellClassName: (params) => (params.row._isSkipped ? 'import-skipped-cell' : ''),
      },
    ];

    for (let c = 0; c < colCount; c++) {
      const colIdx = c;
      const mapped = isColMapped(colIdx);
      cols.push({
        field: `col_${c}`,
        headerName: '',
        width: colWidths[c],
        minWidth: 80,
        sortable: false,
        disableColumnMenu: true,
        renderHeader: () => (
          <Autocomplete
            size="small"
            options={fieldOptions}
            getOptionLabel={(o) => o.label}
            value={fieldOptions.find((o) => o.field === (mapping[String(colIdx)] ?? NOT_USED)) ?? fieldOptions[0]}
            onChange={(_, val) => setColumnField(colIdx, val?.field ?? null)}
            isOptionEqualToValue={(o, v) => o.field === v.field}
            disableClearable
            fullWidth
            slotProps={{
              popper: { sx: { '& .MuiAutocomplete-option': { fontSize: '0.8rem' } } },
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '& .MuiInputBase-input': { fontSize: '0.75rem' },
                }}
              />
            )}
          />
        ),
        cellClassName: (params) => {
          const classes: string[] = [];
          if (!mapped) classes.push('import-unmapped-cell');
          if (params.row._isSkipped) classes.push('import-skipped-cell');
          return classes.join(' ');
        },
      });
    }

    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colCount, mapping, fieldOptions]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 1, px: 2 }}>
      {/* DataGrid */}
      <Box sx={{ height: 400 }}>
        <DataGrid
          rows={gridRows}
          columns={gridColumns}
          disableRowSelectionOnClick
          disableColumnMenu
          disableColumnSelector
          disableColumnResize
          cellSelection={false}
          hideFooter={rows.length <= 100}
          initialState={{
            pagination: { paginationModel: { pageSize: 100 } },
          }}
          pageSizeOptions={[100]}
          columnHeaderHeight={52}
          rowHeight={32}
          sx={{
            height: '100%',
            fontSize: '0.8rem',
            '& .import-unmapped-cell': {
              bgcolor: disabledBg,
            },
            '& .import-skipped-cell': {
              bgcolor: disabledBg,
              color: 'text.disabled',
            },
            '& .MuiDataGrid-columnHeader': {
              px: 0.5,
            },
            '& .MuiDataGrid-columnHeaderTitleContainer': {
              width: '100%',
            },
            '& .MuiDataGrid-columnHeaderTitleContainerContent': {
              width: '100%',
            },
            '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
              outline: 'none',
            },
            '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
              outline: 'none',
            },
          }}
        />
      </Box>

      {/* Start from row */}
      <Box sx={{ width: 200 }}>
        <NumberSpinner
          label="Start from row"
          size="small"
          value={startFromRow + 1}
          onValueChange={(val) => {
            if (val !== null && val >= 1 && val <= rows.length) {
              onStartFromRowChange(val - 1);
            }
          }}
          min={1}
          max={rows.length}
          step={1}
        />
      </Box>

      {/* Import mode */}
      <Box>
        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
          Import mode
        </Typography>
        <FormControl>
          <RadioGroup
            value={importMode}
            onChange={(e) => onImportModeChange(e.target.value)}
          >
            {IMPORT_MODES.map((m) => (
              <FormControlLabel
                key={m.value}
                value={m.value}
                control={<Radio size="small" />}
                label={
                  <Box>
                    <Typography variant="body2">{m.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {m.description}
                    </Typography>
                  </Box>
                }
              />
            ))}
          </RadioGroup>
        </FormControl>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onBack}>Back</Button>
        <Button
          variant="contained"
          onClick={onNext}
          disabled={mappedCount === 0}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
}
