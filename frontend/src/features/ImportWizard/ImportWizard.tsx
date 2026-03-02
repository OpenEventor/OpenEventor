import { useCallback, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { api } from '../../api/client';
import type { ImportExecuteRequest, ImportExecuteResponse, ImportFieldDef } from '../../api/types';
import SourceStep from './SourceStep';
import PasteStep from './PasteStep';
import PreviewStep from './PreviewStep';
import SummaryStep from './SummaryStep';
import { autoDetectMapping } from './fieldDefinitions';

type Step = 'source' | 'paste' | 'preview' | 'summary';

interface ImportWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  entityName: string;
  fields: ImportFieldDef[];
  parseUrl: string;
  importUrl: string;
}

export default function ImportWizard({
  open,
  onClose,
  onComplete,
  entityName,
  fields,
  parseUrl,
  importUrl,
}: ImportWizardProps) {
  const [step, setStep] = useState<Step>('source');
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [startFromRow, setStartFromRow] = useState(1);
  const [importMode, setImportMode] = useState('append');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportExecuteResponse | null>(null);

  const storageKey = `openeventor_import_mapping_${entityName}`;

  const reset = useCallback(() => {
    setStep('source');
    setRawRows([]);
    setMapping({});
    setStartFromRow(1);
    setImportMode('append');
    setLoading(false);
    setError(null);
    setResult(null);
  }, []);

  const handleClose = () => {
    if (result) {
      onComplete();
    }
    reset();
    onClose();
  };

  const initMapping = useCallback((rows: string[][]) => {
    // Try loading saved mapping from localStorage.
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, string>;
        // Validate that saved column indices are within bounds.
        const colCount = rows.length > 0 ? rows[0].length : 0;
        const valid: Record<string, string> = {};
        const fieldSet = new Set(fields.map((f) => f.field));
        for (const [key, val] of Object.entries(parsed)) {
          const idx = parseInt(key, 10);
          if (!isNaN(idx) && idx >= 0 && idx < colCount && fieldSet.has(val)) {
            valid[key] = val;
          }
        }
        if (Object.keys(valid).length > 0) {
          return valid;
        }
      }
    } catch {
      // Ignore invalid localStorage data.
    }

    // Auto-detect from first row.
    if (rows.length > 0) {
      return autoDetectMapping(rows[0], fields);
    }

    return {};
  }, [storageKey, fields]);

  const handleFileLoaded = (rows: string[][]) => {
    setRawRows(rows);
    setMapping(initMapping(rows));
    setStep('preview');
  };

  const handlePasteParsed = (rows: string[][]) => {
    setRawRows(rows);
    setMapping(initMapping(rows));
    setStep('preview');
  };

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    try {
      const body: ImportExecuteRequest = {
        mode: importMode,
        startFromRow,
        mapping,
        rows: rawRows,
      };
      const res = await api.post<ImportExecuteResponse>(importUrl, body);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const stepTitle: Record<Step, string> = {
    source: 'Import — Select source',
    paste: 'Import — Paste data',
    preview: 'Import — Preview & mapping',
    summary: result ? 'Import — Result' : 'Import — Confirm',
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : handleClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
        {stepTitle[step]}
        <IconButton size="small" onClick={handleClose} disabled={loading}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {step === 'source' && (
          <SourceStep
            parseUrl={parseUrl}
            onFileLoaded={handleFileLoaded}
            onPasteSelected={() => setStep('paste')}
            onError={setError}
          />
        )}
        {step === 'paste' && (
          <PasteStep
            onParsed={handlePasteParsed}
            onBack={() => setStep('source')}
          />
        )}
        {step === 'preview' && (
          <PreviewStep
            rows={rawRows}
            fields={fields}
            mapping={mapping}
            onMappingChange={setMapping}
            startFromRow={startFromRow}
            onStartFromRowChange={setStartFromRow}
            importMode={importMode}
            onImportModeChange={setImportMode}
            onNext={() => setStep('summary')}
            onBack={() => setStep('source')}
            storageKey={storageKey}
          />
        )}
        {step === 'summary' && (
          <SummaryStep
            rows={rawRows}
            startFromRow={startFromRow}
            mapping={mapping}
            importMode={importMode}
            fields={fields}
            loading={loading}
            result={result}
            error={error}
            onExecute={handleExecute}
            onBack={() => setStep('preview')}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
