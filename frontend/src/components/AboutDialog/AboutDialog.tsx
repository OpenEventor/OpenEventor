import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { api } from '../../api/client.ts';
import logoSvg from '../../assets/logo.svg';

/** Frontend build version — baked in by Vite at build time; 'dev' locally. */
const UI_VERSION: string = (import.meta.env.VITE_APP_VERSION as string | undefined) || 'dev';

// About dialog: logo, short description, and — the diagnostic part — BOTH
// versions: the server's (live from /api/version) and this bundle's own.
// The binary embeds the UI, so they always match in a healthy install; a
// mismatch means the browser is serving a stale cached UI.
export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [serverVersion, setServerVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setServerVersion(null);
    api
      .get<{ version: string }>('/api/version')
      .then((r) => setServerVersion(r.version))
      .catch(() => setServerVersion(t('about.unreachable')));
  }, [open, t]);

  const mismatch =
    serverVersion !== null && serverVersion !== UI_VERSION && serverVersion !== t('about.unreachable');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogContent sx={{ textAlign: 'center', pt: 4 }}>
        <Box
          component="img"
          src={logoSvg}
          alt="OpenEventor"
          sx={{
            width: 72,
            height: 72,
            mb: 1.5,
            filter: theme.palette.mode === 'light' ? 'brightness(0)' : 'none',
          }}
        />
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
          OpenEventor
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          {t('about.description')}
        </Typography>

        <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {t('about.serverVersion')}: {serverVersion ?? '…'}
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {t('about.uiVersion')}: {UI_VERSION}
          </Typography>
        </Stack>

        {mismatch && (
          <Alert severity="warning" sx={{ mt: 2, textAlign: 'left' }}>
            {t('about.versionMismatch')}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
