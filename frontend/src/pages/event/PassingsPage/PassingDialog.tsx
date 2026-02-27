import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { joiResolver } from '@hookform/resolvers/joi';
import Joi from 'joi';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  TextField,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { api } from '../../../api/client.ts';
import type { Passing } from '../../../api/types.ts';

interface PassingFormData {
  card: string;
  checkpoint: string;
  timestamp: number | '';
  enabled: number;
  source: string;
}

const schema = Joi.object<PassingFormData>({
  card: Joi.string().required().messages({ 'string.empty': 'Card is required' }),
  checkpoint: Joi.string().required().messages({ 'string.empty': 'Checkpoint is required' }),
  timestamp: Joi.number().greater(0).required().messages({ 'number.base': 'Timestamp is required', 'number.greater': 'Timestamp must be greater than 0' }),
  enabled: Joi.number().valid(0, 1).optional(),
  source: Joi.string().allow('').optional(),
});

const DEFAULT_VALUES: PassingFormData = {
  card: '', checkpoint: '', timestamp: '', enabled: 1, source: 'manual',
};

function formToPayload(data: PassingFormData) {
  return {
    ...data,
    timestamp: data.timestamp === '' ? 0 : Number(data.timestamp),
  };
}

interface PassingDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  eventId: string;
  passing?: Passing | null;
}

export function PassingDialog({ open, onClose, onSaved, eventId, passing }: PassingDialogProps) {
  const isEdit = Boolean(passing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<PassingFormData>({
    resolver: joiResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(passing ? {
        card: passing.card, checkpoint: passing.checkpoint,
        timestamp: passing.timestamp || '', enabled: passing.enabled, source: passing.source,
      } : DEFAULT_VALUES);
      setError(null);
    }
  }, [open, passing, reset]);

  const onSubmit = async (data: PassingFormData) => {
    setSaving(true);
    setError(null);
    try {
      const payload = formToPayload(data);
      if (isEdit && passing) {
        await api.put(`/api/events/${eventId}/passings/${passing.id}`, payload);
      } else {
        await api.post(`/api/events/${eventId}/passings/manual`, payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => { if (!saving) onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
        {isEdit ? 'Edit passing' : 'New passing'}
        <IconButton size="small" onClick={handleClose} disabled={saving}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form id="passing-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="card" control={control} render={({ field }) => (
                <TextField {...field} label="Card" required fullWidth size="small" error={!!errors.card} helperText={errors.card?.message as string} disabled={saving} autoFocus />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="checkpoint" control={control} render={({ field }) => (
                <TextField {...field} label="Checkpoint" required fullWidth size="small" error={!!errors.checkpoint} helperText={errors.checkpoint?.message as string} disabled={saving} />
              )} />
            </Grid>
            <Grid size={12}>
              <Controller name="timestamp" control={control} render={({ field }) => (
                <TextField {...field} label="Timestamp" required fullWidth size="small" type="number" placeholder="1740000000.00" error={!!errors.timestamp} helperText={errors.timestamp?.message as string} disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="source" control={control} render={({ field }) => (
                <TextField {...field} label="Source" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="enabled" control={control} render={({ field }) => (
                <FormControlLabel control={<Checkbox checked={field.value === 1} onChange={(_, checked) => field.onChange(checked ? 1 : 0)} size="small" disabled={saving} />} label="Enabled" />
              )} />
            </Grid>
          </Grid>
        </form>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" type="submit" form="passing-form" disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
