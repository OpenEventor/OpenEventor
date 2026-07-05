import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import Field from '../../../components/Field/Field.tsx';
import { api } from '../../../api/client.ts';
import type { Passing } from '../../../api/types.ts';

interface PassingFormData {
  card: string;
  checkpoint: string;
  timestamp: number | '';
  enabled: number;
  sortOrder: number;
  source: string;
}

const DEFAULT_VALUES: PassingFormData = {
  card: '', checkpoint: '', timestamp: '', enabled: 1, sortOrder: 0, source: 'manual',
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
  const { t } = useTranslation();
  const isEdit = Boolean(passing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schema = useMemo(() => Joi.object<PassingFormData>({
    card: Joi.string().required().messages({ 'string.empty': t('passings.cardRequired') }),
    checkpoint: Joi.string().required().messages({ 'string.empty': t('passings.checkpointRequired') }),
    timestamp: Joi.number().greater(0).required().messages({ 'number.base': t('passings.timestampRequired'), 'number.greater': t('passings.timestampPositive') }),
    enabled: Joi.number().valid(0, 1).optional(),
    sortOrder: Joi.number().integer().min(0).optional(),
    source: Joi.string().allow('').optional(),
  }), [t]);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<PassingFormData>({
    resolver: joiResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(passing ? {
        card: passing.card, checkpoint: passing.checkpoint,
        timestamp: passing.timestamp || '', enabled: passing.enabled,
        sortOrder: passing.sortOrder, source: passing.source,
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
      setError(err instanceof Error ? err.message : t('passings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => { if (!saving) onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
        {isEdit ? t('passings.editTitle') : t('passings.newTitle')}
        <IconButton size="small" onClick={handleClose} disabled={saving}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form id="passing-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="card" control={control} render={({ field }) => (
                <Field label={t('passings.card')} required error={!!errors.card}>
                  <TextField {...field} required fullWidth size="small" error={!!errors.card} helperText={errors.card?.message as string} disabled={saving} autoFocus />
                </Field>
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="checkpoint" control={control} render={({ field }) => (
                <Field label={t('passings.checkpoint')} required error={!!errors.checkpoint}>
                  <TextField {...field} required fullWidth size="small" error={!!errors.checkpoint} helperText={errors.checkpoint?.message as string} disabled={saving} />
                </Field>
              )} />
            </Grid>
            <Grid size={12}>
              <Controller name="timestamp" control={control} render={({ field }) => (
                <Field label={t('passings.timestamp')} required error={!!errors.timestamp}>
                  <TextField {...field} required fullWidth size="small" type="number" placeholder="1740000000.00" error={!!errors.timestamp} helperText={errors.timestamp?.message as string} disabled={saving} />
                </Field>
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="source" control={control} render={({ field }) => (
                <Field label={t('passings.source')}>
                  <TextField {...field} fullWidth size="small" disabled={saving} />
                </Field>
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Controller name="sortOrder" control={control} render={({ field }) => (
                <Field label={t('passings.sortOrder')}>
                  <TextField {...field} fullWidth size="small" type="number" disabled={saving} />
                </Field>
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Controller name="enabled" control={control} render={({ field }) => (
                <FormControlLabel control={<Checkbox checked={field.value === 1} onChange={(_, checked) => field.onChange(checked ? 1 : 0)} size="small" disabled={saving} />} label={t('passings.enabled')} />
              )} />
            </Grid>
          </Grid>
        </form>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={handleClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button variant="contained" type="submit" form="passing-form" disabled={saving}>
          {saving ? t('common.saving') : isEdit ? t('common.save') : t('common.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
