import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Add as AddIcon,
  DeleteOutlined as DeleteIcon,
} from '@mui/icons-material';
import Field from '../../components/Field/Field.tsx';
import { api } from '../../api/client.ts';
import type { EventItem, RenameRule, TimingSystem } from '../../api/types.ts';
import { TimingLogo } from './TimingLogo.tsx';
import { HubStatusPanel } from './HubStatusPanel.tsx';
import { timingUrl } from './timingCatalog.ts';

interface Props {
  system: TimingSystem;
  events: EventItem[];
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function TimingSystemDialog({ system, events, open, onClose, onChanged }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(system.name);
  const [eventId, setEventId] = useState(system.eventId);
  const [enabled, setEnabled] = useState(system.enabled === 1);
  const [rules, setRules] = useState<RenameRule[]>(system.rules);
  const [hubUrl, setHubUrl] = useState(system.hubUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setName(system.name);
      setEventId(system.eventId);
      setEnabled(system.enabled === 1);
      setRules(system.rules);
      setHubUrl(system.hubUrl ?? '');
    }
  }, [open, system]);

  const isHub = system.kind === 'hub';
  const url = timingUrl(system.kind);

  const copy = () => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.put(`/api/timing-systems/${system.id}`, {
        name: name.trim(),
        eventId,
        enabled: enabled ? 1 : 0,
        rules,
        hubUrl: hubUrl.trim(),
      });
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t('timing.confirmDelete', { name: system.name }))) return;
    setSaving(true);
    try {
      await api.del(`/api/timing-systems/${system.id}`);
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const setRule = (i: number, patch: Partial<RenameRule>) =>
    setRules((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5 }}>
        <TimingLogo kind={system.kind} size={32} />
        <Typography variant="h6" component="span" sx={{ flex: 1, minWidth: 0 }} noWrap>
          {name || t(`timing.kind.${system.kind}`)}
        </Typography>
        <IconButton size="small" onClick={onClose} disabled={saving}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Field label={t('timing.name')}>
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              size="small"
              fullWidth
              disabled={saving}
            />
          </Field>

          <FormControlLabel
            control={
              <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={saving} />
            }
            label={t('timing.activeToggle')}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: -1.5 }}>
            {t('timing.onlyOneActive')}
          </Typography>

          <Field label={t('timing.targetEvent')}>
            <TextField
              select
              size="small"
              fullWidth
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              disabled={saving}
            >
              <MenuItem value="">
                <em>{t('timing.noEvent')}</em>
              </MenuItem>
              {events.map((ev) => (
                <MenuItem key={ev.id} value={ev.id}>
                  {ev.displayName}
                </MenuItem>
              ))}
            </TextField>
          </Field>
          {enabled && !eventId && (
            <Typography variant="caption" sx={{ color: 'warning.main', mt: -1.5 }}>
              {t('timing.warnNoEvent')}
            </Typography>
          )}

          {isHub ? (
            <>
              <Field label={t('timing.hubUrl')} helperText={t('timing.hubUrlHint')}>
                <TextField
                  value={hubUrl}
                  onChange={(e) => setHubUrl(e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="openeventor.local:8080"
                  disabled={saving}
                  slotProps={{
                    input: { sx: { fontFamily: 'monospace', fontSize: '0.8rem' } },
                  }}
                />
              </Field>
              <Field label={t('timing.hubStatus')}>
                <HubStatusPanel systemId={system.id} hubUrl={system.hubUrl ?? ''} />
              </Field>
            </>
          ) : (
            <Field label={t('timing.receiveUrl')} helperText={t('timing.receiveHint')}>
              <TextField
                value={url}
                size="small"
                fullWidth
                slotProps={{
                  input: {
                    readOnly: true,
                    sx: { fontFamily: 'monospace', fontSize: '0.8rem' },
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={copied ? t('timing.copied') : t('timing.copyLink')} arrow>
                          <IconButton size="small" onClick={copy} edge="end">
                            {copied ? <CheckIcon fontSize="small" color="success" /> : <CopyIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Field>
          )}

          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                {t('timing.rules')}
              </Typography>
              <Tooltip title={t('timing.addRule')} arrow>
                <IconButton
                  size="small"
                  disabled={saving}
                  onClick={() => setRules((r) => [...r, { rawId: '', name: '', timeAdjustment: 0 }])}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            {rules.length === 0 ? (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t('timing.noRules')}
              </Typography>
            ) : (
              <Stack spacing={1}>
                {rules.map((r, i) => (
                  <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <TextField
                      label={t('timing.ruleRawId')}
                      value={r.rawId}
                      onChange={(e) => setRule(i, { rawId: e.target.value })}
                      size="small"
                      sx={{ width: 100 }}
                      disabled={saving}
                    />
                    <TextField
                      label={t('timing.ruleName')}
                      value={r.name}
                      onChange={(e) => setRule(i, { name: e.target.value })}
                      size="small"
                      sx={{ flex: 1 }}
                      disabled={saving}
                    />
                    <TextField
                      label={t('timing.ruleAdjust')}
                      value={r.timeAdjustment}
                      onChange={(e) => setRule(i, { timeAdjustment: parseInt(e.target.value, 10) || 0 })}
                      size="small"
                      type="number"
                      sx={{ width: 100 }}
                      disabled={saving}
                    />
                    <IconButton
                      size="small"
                      disabled={saving}
                      onClick={() => setRules((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, justifyContent: 'space-between' }}>
        <Button color="error" startIcon={<DeleteIcon />} onClick={remove} disabled={saving}>
          {t('common.delete')}
        </Button>
        <Box>
          <Button onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={save} disabled={saving || !name.trim()} sx={{ ml: 1 }}>
            {t('common.save')}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
