import { Box, Typography } from '@mui/material';

export function ProtocolsPage() {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Protocols
      </Typography>
      <Typography color="text.secondary">
        Event protocols and results will appear here.
      </Typography>
    </Box>
  );
}
