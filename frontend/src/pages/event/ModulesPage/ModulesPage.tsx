import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export function ModulesPage() {
  const { t } = useTranslation();

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {t('modules.title')}
      </Typography>
      <Typography sx={{
        color: "text.secondary"
      }}>
        {t('modules.overview')}
      </Typography>
    </Box>
  );
}
