import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useEvent } from '../../../contexts/EventContext.tsx';

export function SettingsPage() {
  const { t } = useTranslation();
  const { settings, loading } = useEvent();
  const entries = Object.entries(settings);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {t('settings.title')}
      </Typography>
      {loading ? (
        <Typography sx={{
          color: "text.secondary"
        }}>{t('common.loading')}</Typography>
      ) : entries.length === 0 ? (
        <Typography sx={{
          color: "text.secondary"
        }}>{t('settings.empty')}</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>{t('settings.key')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('settings.value')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{key}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
