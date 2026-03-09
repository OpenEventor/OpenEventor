import { useState } from 'react';
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
  const [name, setName] = useState('');
  const [date, setDate] = useState<Dayjs | null>(null);
  const [timezone, setTimezone] = useState(getBrowserTimezone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Event name is required');
      return;
    }
    if (!date?.isValid()) {
      setError('Date is required');
      return;
    }
    if (!timezone) {
      setError('Timezone is required');
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
      setError(err instanceof Error ? err.message : 'Failed to create event');
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
      <DialogTitle>Create Event</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Event name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          disabled={loading}
          variant="filled"
        />
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label="Date"
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
          renderInput={(params) => <TextField {...params} label="Timezone" variant="filled" />}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
