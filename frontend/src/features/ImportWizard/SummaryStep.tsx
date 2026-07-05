import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { Trans, useTranslation } from 'react-i18next';
import type { ImportExecuteResponse, ImportFieldDef } from '../../api/types';

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
  const { t } = useTranslation();
  const MODE_LABELS: Record<string, string> = {
    append: t('import.modeLabels.append'),
    replace_by_bib_ignore: t('import.modes.updateSkip'),
    replace_by_bib_add: t('import.modes.updateAdd'),
    clear_and_import: t('import.modeLabels.clear'),
  };
  const dataRowCount = rows.length - startFromRow;
  const mappedFields = Object.values(mapping).map((f) => {
    const label = fields.find((fd) => fd.field === f)?.label;
    return label ? t(label) : f;
  });

  // Result view.
  if (result) {
    return (
      <Box sx={{ py: 3, px: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Typography variant="h6">{t('import.complete')}</Typography>
        <Box sx={{ display: 'flex', gap: 3 }}>
          {result.created > 0 && (
            <Typography variant="body1" sx={{
              color: "success.main"
            }}>
              {t('import.created', { count: result.created })}
            </Typography>
          )}
          {result.updated > 0 && (
            <Typography variant="body1" sx={{
              color: "info.main"
            }}>
              {t('import.updated', { count: result.updated })}
            </Typography>
          )}
          {result.skipped > 0 && (
            <Typography variant="body1" sx={{
              color: "text.secondary"
            }}>
              {t('import.skipped', { count: result.skipped })}
            </Typography>
          )}
        </Box>
        {result.errors.length > 0 && (
          <Alert severity="warning" sx={{ width: '100%' }}>
            {t('import.errorsCount', { count: result.errors.length })}
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {result.errors.slice(0, 10).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {result.errors.length > 10 && <li>{t('import.andMore', { count: result.errors.length - 10 })}</li>}
            </ul>
          </Alert>
        )}
        <Button variant="contained" onClick={onClose}>
          {t('common.close')}
        </Button>
      </Box>
    );
  }

  // Loading view.
  if (loading) {
    return (
      <Box sx={{ py: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <CircularProgress />
        <Typography sx={{
          color: "text.secondary"
        }}>{t('import.importing')}</Typography>
      </Box>
    );
  }

  // Summary view.
  return (
    <Box sx={{ py: 2, px: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body1">
        <Trans
          i18nKey="import.willImport"
          values={{ rows: dataRowCount, fields: mappedFields.length }}
          components={{ b: <strong /> }}
        />
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>
          {t('import.mappedFields', { fields: mappedFields.join(', ') })}
        </Typography>
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>
          {t('import.mode', { mode: MODE_LABELS[importMode] ?? importMode })}
        </Typography>
      </Box>
      {importMode === 'clear_and_import' && (
        <Alert severity="error">
          {t('import.clearWarning')}
        </Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onBack}>{t('common.back')}</Button>
        <Button
          variant="contained"
          color={importMode === 'clear_and_import' ? 'error' : 'primary'}
          onClick={onExecute}
        >
          {t('common.import')}
        </Button>
      </Box>
    </Box>
  );
}
