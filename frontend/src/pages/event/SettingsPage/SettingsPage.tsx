import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { useEvent } from '../../../contexts/EventContext.tsx';

export function SettingsPage() {
  const { settings, loading } = useEvent();
  const entries = Object.entries(settings);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Settings
      </Typography>
      {loading ? (
        <Typography color="text.secondary">Loading...</Typography>
      ) : entries.length === 0 ? (
        <Typography color="text.secondary">No settings found.</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Key</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Value</TableCell>
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
