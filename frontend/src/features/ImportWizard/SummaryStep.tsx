import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import type { ImportExecuteResponse, ImportFieldDef } from '../../api/types';

const MODE_LABELS: Record<string, string> = {
  append: 'Append (add all as new)',
  replace_by_bib_ignore: 'Update by bib (skip unknown)',
  replace_by_bib_add: 'Update by bib (add new)',
  clear_and_import: 'Clear all and import',
};

interface SummaryStepProps {
  rows: string[][];
  startFromRow: number;
  mapping: Record<string, string>;
  importMode: string;
  fields: ImportFieldDef[];
  loading: boolean;
  result: ImportExecuteResponse | null;
  error: string | null;
  onExecute: () => void;
  onBack: () => void;
  onClose: () => void;
}

export default function SummaryStep({
  rows,
  startFromRow,
  mapping,
  importMode,
  fields,
  loading,
  result,
  error,
  onExecute,
  onBack,
  onClose,
}: SummaryStepProps) {
  const dataRowCount = rows.length - startFromRow;
  const mappedFields = Object.values(mapping).map(
    (f) => fields.find((fd) => fd.field === f)?.label ?? f,
  );

  // Result view.
  if (result) {
    return (
      <Box sx={{ py: 3, px: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Typography variant="h6">Import complete</Typography>
        <Box sx={{ display: 'flex', gap: 3 }}>
          {result.created > 0 && (
            <Typography variant="body1" color="success.main">
              Created: {result.created}
            </Typography>
          )}
          {result.updated > 0 && (
            <Typography variant="body1" color="info.main">
              Updated: {result.updated}
            </Typography>
          )}
          {result.skipped > 0 && (
            <Typography variant="body1" color="text.secondary">
              Skipped: {result.skipped}
            </Typography>
          )}
        </Box>
        {result.errors.length > 0 && (
          <Alert severity="warning" sx={{ width: '100%' }}>
            {result.errors.length} error(s):
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {result.errors.slice(0, 10).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {result.errors.length > 10 && <li>...and {result.errors.length - 10} more</li>}
            </ul>
          </Alert>
        )}
        <Button variant="contained" onClick={onClose}>
          Close
        </Button>
      </Box>
    );
  }

  // Loading view.
  if (loading) {
    return (
      <Box sx={{ py: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <CircularProgress />
        <Typography color="text.secondary">Importing...</Typography>
      </Box>
    );
  }

  // Summary view.
  return (
    <Box sx={{ py: 2, px: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body1">
        <strong>{dataRowCount}</strong> rows will be imported with{' '}
        <strong>{mappedFields.length}</strong> mapped fields.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          Mapped fields: {mappedFields.join(', ')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Mode: {MODE_LABELS[importMode] ?? importMode}
        </Typography>
      </Box>

      {importMode === 'clear_and_import' && (
        <Alert severity="error">
          This will DELETE all existing competitors before importing. This action cannot be undone.
        </Alert>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onBack}>Back</Button>
        <Button
          variant="contained"
          color={importMode === 'clear_and_import' ? 'error' : 'primary'}
          onClick={onExecute}
        >
          Import
        </Button>
      </Box>
    </Box>
  );
}
