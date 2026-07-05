import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { joiResolver } from '@hookform/resolvers/joi';
import Joi from 'joi';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { api } from '../../../api/client.ts';
import type { Checkpoint } from '../../../api/types.ts';

interface CheckpointFormData {
  name: string;
  latitude: number | '';
  longitude: number | '';
  sortOrder: number | '';
  description: string;
}

const DEFAULT_VALUES: CheckpointFormData = {
  name: '', latitude: '', longitude: '', sortOrder: '', description: '',
};

interface CheckpointDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  eventId: string;
  checkpoint?: Checkpoint | null;
}

function checkpointToForm(c: Checkpoint): CheckpointFormData {
  return {
    name: c.name,
    latitude: c.latitude ?? '',
    longitude: c.longitude ?? '',
    sortOrder: c.sortOrder || '',
    description: c.description,
  };
}

function formToPayload(data: CheckpointFormData) {
  return {
    name: data.name,
    description: data.description,
    sortOrder: data.sortOrder === '' ? 0 : Number(data.sortOrder),
    latitude: data.latitude === '' ? null : Number(data.latitude),
    longitude: data.longitude === '' ? null : Number(data.longitude),
  };
}

// Parses a pasted "55.75, 37.61" (comma- or space-separated) into a lat/lon pair.
function parseCoords(input: string): { lat: number; lon: number } | null {
  const parts = input.split(/[,\s]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { lat, lon };
}

function formatCoords(lat: number | null | '', lon: number | null | ''): string {
  if (lat === '' || lat == null || lon === '' || lon == null) return '';
  return `${lat}, ${lon}`;
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 600, color: 'text.secondary', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {children}
    </Typography>
  );
}

export function CheckpointDialog({ open, onClose, onSaved, eventId, checkpoint }: CheckpointDialogProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(checkpoint);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coordsInput, setCoordsInput] = useState('');

  const schema = useMemo(() => Joi.object<CheckpointFormData>({
    name: Joi.string().required().messages({ 'string.empty': t('common.nameRequired') }),
    latitude: Joi.alternatives().try(Joi.number().min(-90).max(90), Joi.string().valid('')).optional(),
    longitude: Joi.alternatives().try(Joi.number().min(-180).max(180), Joi.string().valid('')).optional(),
    sortOrder: Joi.alternatives().try(Joi.number().integer(), Joi.string().valid('')).optional(),
    description: Joi.string().allow('').optional(),
  }), [t]);

  const { control, handleSubmit, reset, setValue, formState: { errors } } = useForm<CheckpointFormData>({
    resolver: joiResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      const form = checkpoint ? checkpointToForm(checkpoint) : DEFAULT_VALUES;
      reset(form);
      setCoordsInput(formatCoords(form.latitude, form.longitude));
      setError(null);
    }
  }, [open, checkpoint, reset]);

  // Convenience: paste "lat, lon" to fill both fields; clearing resets them to null.
  const handleCoordsChange = (value: string) => {
    setCoordsInput(value);
    if (value.trim() === '') {
      setValue('latitude', '');
      setValue('longitude', '');
      return;
    }
    const parsed = parseCoords(value);
    if (parsed) {
      setValue('latitude', parsed.lat);
      setValue('longitude', parsed.lon);
    }
  };

  const onSubmit = async (data: CheckpointFormData) => {
    setSaving(true);
    setError(null);
    try {
      const payload = formToPayload(data);
      if (isEdit && checkpoint) {
        await api.put(`/api/events/${eventId}/checkpoints/${checkpoint.id}`, payload);
      } else {
        await api.post(`/api/events/${eventId}/checkpoints`, payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => { if (!saving) onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
        {isEdit ? t('checkpoints.dialog.editTitle') : t('checkpoints.dialog.newTitle')}
        <IconButton size="small" onClick={handleClose} disabled={saving}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form id="checkpoint-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Basic */}
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <Controller name="name" control={control} render={({ field }) => (
                <TextField {...field} label={t('common.name')} required fullWidth size="small" error={!!errors.name} helperText={errors.name?.message as string} disabled={saving} autoFocus />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="sortOrder" control={control} render={({ field }) => (
                <TextField {...field} label={t('checkpoints.dialog.sortOrder')} fullWidth size="small" type="number" disabled={saving} />
              )} />
            </Grid>
          </Grid>

          {/* Coordinates */}
          <SectionTitle>{t('checkpoints.dialog.coordinates')}</SectionTitle>
          <TextField
            label={t('checkpoints.dialog.pasteCoords')}
            fullWidth
            size="small"
            placeholder="55.75, 37.61"
            helperText={t('checkpoints.dialog.pasteCoordsHelper')}
            value={coordsInput}
            onChange={(e) => handleCoordsChange(e.target.value)}
            disabled={saving}
          />
          <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 6 }}>
              <Controller name="latitude" control={control} render={({ field }) => (
                <TextField {...field} label={t('checkpoints.columns.latitude')} fullWidth size="small" type="number" error={!!errors.latitude} helperText={errors.latitude?.message as string} disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Controller name="longitude" control={control} render={({ field }) => (
                <TextField {...field} label={t('checkpoints.columns.longitude')} fullWidth size="small" type="number" error={!!errors.longitude} helperText={errors.longitude?.message as string} disabled={saving} />
              )} />
            </Grid>
          </Grid>

          {/* Description */}
          <SectionTitle>{t('common.description')}</SectionTitle>
          <Controller name="description" control={control} render={({ field }) => (
            <TextField {...field} label={t('common.description')} fullWidth size="small" multiline minRows={2} maxRows={4} disabled={saving} />
          )} />
        </form>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={handleClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button variant="contained" type="submit" form="checkpoint-form" disabled={saving}>
          {saving ? t('common.saving') : isEdit ? t('common.save') : t('common.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
