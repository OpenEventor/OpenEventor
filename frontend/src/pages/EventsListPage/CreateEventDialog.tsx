import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Autocomplete,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import type { Dayjs } from 'dayjs';
import { api } from '../../api/client.ts';
import type { EventItem } from '../../api/types.ts';

const TIMEZONES = Intl.supportedValuesOf('timeZone');

function getGmtOffset(tz: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
    const parts = fmt.formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

const TZ_LABELS = new Map(TIMEZONES.map((tz) => [tz, `${tz} (${getGmtOffset(tz)})`]));

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

interface CreateEventDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (event: EventItem) => void;
}

export function CreateEventDialog({ open, onClose, onCreated }: CreateEventDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [date, setDate] = useState<Dayjs | null>(null);
  const [timezone, setTimezone] = useState(getBrowserTimezone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError(t('events.validation.nameRequired'));
      return;
    }
    if (!date?.isValid()) {
      setError(t('events.validation.dateRequired'));
      return;
    }
    if (!timezone) {
      setError(t('events.validation.timezoneRequired'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const event = await api.post<EventItem>('/api/events', {
        displayName: name.trim(),
        date: date.format('YYYY-MM-DD'),
        timezone,
      });
      setName('');
      setDate(null);
      setTimezone(getBrowserTimezone());
      onCreated(event);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('events.errors.create'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setName('');
    setDate(null);
    setTimezone(getBrowserTimezone());
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('events.createEvent')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label={t('events.eventName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          disabled={loading}
          variant="filled"
        />
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label={t('common.date')}
            value={date}
            onChange={(value) => setDate(value)}
            disabled={loading}
            format="DD.MM.YYYY"
            slotProps={{
              textField: {
                variant: 'filled',
                slotProps: {
                  input: {
                    disableUnderline: true,
                    sx: { borderRadius: '4px !important' },
                  },
                },
              },
            }}
          />
        </LocalizationProvider>
        <Autocomplete
          value={timezone}
          onChange={(_, value) => setTimezone(value ?? 'UTC')}
          options={TIMEZONES}
          getOptionLabel={(tz) => TZ_LABELS.get(tz) ?? tz}
          disableClearable
          disabled={loading}
          renderInput={(params) => <TextField {...params} label={t('events.timezone')} variant="filled" />}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={loading}
        >
          {loading ? t('events.creating') : t('common.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
