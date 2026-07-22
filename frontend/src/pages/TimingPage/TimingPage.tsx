import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { Add as AddIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { api } from '../../api/client.ts';
import type { EventItem, TimingSystem } from '../../api/types.ts';
import { TimingSystemCard } from './TimingSystemCard.tsx';
import { TimingSystemDialog } from './TimingSystemDialog.tsx';
import { AddTimingDialog } from './AddTimingDialog.tsx';
import { PAGE_MAX_WIDTH } from '../../layout.ts';

export function TimingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [systems, setSystems] = useState<TimingSystem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<TimingSystem | null>(null);

  const fetchSystems = useCallback(async () => {
    setError(null);
    try {
      setSystems(await api.get<TimingSystem[]>('/api/timing-systems'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('timing.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSystems();
  }, [fetchSystems]);

  useEffect(() => {
    api.get<EventItem[]>('/api/events').then(setEvents).catch(() => {});
  }, []);

  // After creating an instance, refresh and jump straight into its editor.
  const handleCreated = (created: TimingSystem) => {
    fetchSystems();
    setEditing(created);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ width: '100%', maxWidth: PAGE_MAX_WIDTH, mx: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
            <Button color="inherit" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
              {t('timing.back')}
            </Button>
            <Typography variant="h5" noWrap>
              {t('timing.title')}
            </Typography>
          </Stack>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
            {t('timing.add')}
          </Button>
        </Box>

        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {t('timing.intro')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} />
            </Box>
          ) : systems.length === 0 ? (
            <Box sx={{ textAlign: 'center', color: 'text.secondary', py: 8 }}>
              <Typography variant="body1">{t('timing.empty')}</Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {systems.map((s) => (
                <TimingSystemCard key={s.id} system={s} events={events} onOpen={() => setEditing(s)} />
              ))}
            </Stack>
          )}
        </Box>
      </Box>

      <AddTimingDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={handleCreated} />
      {editing && (
        <TimingSystemDialog
          system={editing}
          events={events}
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
          onChanged={fetchSystems}
        />
      )}
    </Box>
  );
}
