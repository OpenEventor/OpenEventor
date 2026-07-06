import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material';
import { api } from '../../api/client.ts';
import type { TimingSystem } from '../../api/types.ts';
import { TIMING_CATALOG } from './timingCatalog.ts';
import { TimingLogo } from './TimingLogo.tsx';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (system: TimingSystem) => void;
}

// Catalog picker — a grid of selectable system kinds (not a dropdown, so it
// scales as more kinds are added). Picking one creates an instance.
export function AddTimingDialog({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const pick = async (kind: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const created = await api.post<TimingSystem>('/api/timing-systems', {
        kind,
        name: t(`timing.kind.${kind}`),
      });
      onCreated(created);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
        {t('timing.addTitle')}
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          {TIMING_CATALOG.map((k) => (
            <Paper
              key={k.id}
              variant="outlined"
              onClick={() => pick(k.id)}
              sx={{
                p: 1.5,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.6 : 1,
                '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
              }}
            >
              <TimingLogo kind={k.id} />
              <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 600 }}>
                {t(k.nameKey)}
              </Typography>
              <ChevronRightIcon sx={{ color: 'text.disabled' }} />
            </Paper>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
