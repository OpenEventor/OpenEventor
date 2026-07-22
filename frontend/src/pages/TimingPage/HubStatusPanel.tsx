import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import {
  CheckCircleOutlined as OkIcon,
  ErrorOutlined as ErrIcon,
  Router as RouterIcon,
} from '@mui/icons-material';
import { api } from '../../api/client.ts';
import type { HubStatus, HubSystem } from '../../api/types.ts';

const POLL_MS = 3000;

function systemChipColor(state: HubSystem['state']): 'success' | 'info' | 'warning' | 'error' | 'default' {
  switch (state) {
    case 'live':
      return 'success';
    case 'connected':
      return 'info';
    case 'connecting':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
}

// Live connection panel for a hub instance: polls the server-side proxy of the
// hub's /v1/hello while visible and renders reachability + per-reader states.
export function HubStatusPanel({ systemId, hubUrl }: { systemId: string; hubUrl: string }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<HubStatus | null>(null);

  useEffect(() => {
    setStatus(null);
    if (!hubUrl.trim()) return;
    let alive = true;
    const poll = () => {
      api
        .get<HubStatus>(`/api/timing-systems/${systemId}/hub-status`)
        .then((s) => alive && setStatus(s))
        .catch(() => alive && setStatus({ reachable: false, error: 'request failed' }));
    };
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [systemId, hubUrl]);

  if (!hubUrl.trim()) {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {t('timing.hubEnterUrl')}
      </Typography>
    );
  }
  if (!status) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.5 }}>
        <CircularProgress size={14} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('timing.hubChecking')}
        </Typography>
      </Stack>
    );
  }
  if (!status.reachable) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.5 }}>
        <ErrIcon fontSize="small" color="error" />
        <Typography variant="body2" color="error">
          {t('timing.hubUnreachable')}
        </Typography>
      </Stack>
    );
  }

  const hello = status.hello ?? {};
  const systems = hello.systems ?? [];
  const puller = status.puller;
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
        <OkIcon fontSize="small" color="success" />
        <Typography variant="body2">
          {t('timing.hubConnected', { version: hello.version ?? '?' })}
        </Typography>
        {hello.clock && !hello.clock.synced && (
          <Chip size="small" color="warning" label={t('timing.hubClockUnset')} />
        )}
        <Chip size="small" variant="outlined" label={t('timing.hubHead', { head: hello.head ?? 0 })} />
        {puller?.streaming && (
          <Chip size="small" variant="outlined" label={t('timing.hubCursor', { cursor: puller.cursor })} />
        )}
      </Stack>
      {puller?.lastError && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          {puller.lastError}
        </Typography>
      )}
      <Stack spacing={0.5} sx={{ mt: 1 }}>
        {systems.length === 0 ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {t('timing.hubNoSystems')}
          </Typography>
        ) : (
          systems.map((s) => (
            <Stack key={s.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <RouterIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                {s.name}
                {s.detail ? ` — ${s.detail}` : ''}
              </Typography>
              <Chip
                size="small"
                color={systemChipColor(s.state)}
                variant={s.state === 'live' ? 'filled' : 'outlined'}
                label={t(`timing.hubSysState.${s.state}`, s.state)}
              />
            </Stack>
          ))
        )}
      </Stack>
    </Box>
  );
}
