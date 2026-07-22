import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Chip, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import type { EventItem, TimingSystem } from '../../api/types.ts';
import { TimingLogo } from './TimingLogo.tsx';
import { timingUrl } from './timingCatalog.ts';

interface Props {
  system: TimingSystem;
  events: EventItem[];
  onOpen: () => void;
}

// Display-only card: logo, name, status, target event, copy-link. Clicking it
// opens the edit dialog.
export function TimingSystemCard({ system, events, onOpen }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const eventName = events.find((e) => e.id === system.eventId)?.displayName ?? '';
  // Hub instances are pull-based: the useful link is the hub's own address, not
  // a receive URL on this server.
  const url = system.kind === 'hub' ? system.hubUrl : timingUrl(system.kind);

  const copy = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  };

  return (
    <Paper
      variant="outlined"
      onClick={onOpen}
      sx={{
        p: 2,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        cursor: 'pointer',
        transition: 'border-color 120ms, background-color 120ms',
        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
      }}
    >
      <TimingLogo kind={system.kind} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
          {system.name}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}>
          <Chip
            size="small"
            color={system.enabled ? 'success' : 'default'}
            variant={system.enabled ? 'filled' : 'outlined'}
            label={system.enabled ? t('timing.active') : t('timing.inactive')}
          />
          <Typography variant="body2" sx={{ color: eventName ? 'text.secondary' : 'warning.main' }}>
            {eventName ? t('timing.routesTo', { name: eventName }) : t('timing.noEventShort')}
          </Typography>
          {system.kind === 'hub' && (
            <Typography variant="body2" sx={{ color: url ? 'text.secondary' : 'warning.main', fontFamily: url ? 'monospace' : undefined }}>
              {url || t('timing.hubNoUrlShort')}
            </Typography>
          )}
        </Stack>
      </Box>
      {url && (
        <Tooltip title={copied ? t('timing.copied') : t('timing.copyLink')} arrow>
          <IconButton onClick={copy}>
            {copied ? <CheckIcon color="success" /> : <CopyIcon />}
          </IconButton>
        </Tooltip>
      )}
    </Paper>
  );
}
