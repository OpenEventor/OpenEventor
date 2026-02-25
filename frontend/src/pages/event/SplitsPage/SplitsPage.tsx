import { Box, Typography } from '@mui/material';

export function SplitsPage() {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Splits
      </Typography>
      <Typography color="text.secondary">
        Timing results will appear here.
      </Typography>
    </Box>
  );
}
