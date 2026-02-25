import { Box, Typography } from '@mui/material';

export function SettingsPage() {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Settings
      </Typography>
      <Typography color="text.secondary">
        Event settings and configuration.
      </Typography>
    </Box>
  );
}
