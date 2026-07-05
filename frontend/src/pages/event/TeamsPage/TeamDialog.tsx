import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import Field from '../../../components/Field/Field.tsx';
import { api } from '../../../api/client.ts';
import type { Team } from '../../../api/types.ts';
import CountryPicker from '../../../components/CountryPicker/CountryPicker.tsx';

interface TeamFormData {
  name: string;
  country: string;
  region: string;
  city: string;
  description: string;
}

const DEFAULT_VALUES: TeamFormData = {
  name: '', country: '', region: '', city: '', description: '',
};

interface TeamDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  eventId: string;
  team?: Team | null;
}

export function TeamDialog({ open, onClose, onSaved, eventId, team }: TeamDialogProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(team);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schema = useMemo(() => Joi.object<TeamFormData>({
    name: Joi.string().required().messages({ 'string.empty': t('teams.nameRequired') }),
    country: Joi.string().allow('').optional(),
    region: Joi.string().allow('').optional(),
    city: Joi.string().allow('').optional(),
    description: Joi.string().allow('').optional(),
  }), [t]);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<TeamFormData>({
    resolver: joiResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(team ? { name: team.name, country: team.country, region: team.region, city: team.city, description: team.description } : DEFAULT_VALUES);
      setError(null);
    }
  }, [open, team, reset]);

  const onSubmit = async (data: TeamFormData) => {
    setSaving(true);
    setError(null);
    try {
      if (isEdit && team) {
        await api.put(`/api/events/${eventId}/teams/${team.id}`, data);
      } else {
        await api.post(`/api/events/${eventId}/teams`, data);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('teams.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => { if (!saving) onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
        {isEdit ? t('teams.editTitle') : t('teams.newTitle')}
        <IconButton size="small" onClick={handleClose} disabled={saving}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form id="team-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Grid container spacing={1.5}>
            <Grid size={12}>
              <Controller name="name" control={control} render={({ field }) => (
                <Field label={t('common.name')} required error={!!errors.name}>
                  <TextField {...field} required fullWidth size="small" error={!!errors.name} helperText={errors.name?.message as string} disabled={saving} autoFocus />
                </Field>
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="country" control={control} render={({ field }) => (
                <CountryPicker
                  value={field.value}
                  onChange={field.onChange}
                  label={t('teams.country')}
                  variant="outlined"
                  size="small"
                  disabled={saving}
                  fullWidth
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="region" control={control} render={({ field }) => (
                <Field label={t('teams.region')}>
                  <TextField {...field} fullWidth size="small" disabled={saving} />
                </Field>
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="city" control={control} render={({ field }) => (
                <Field label={t('teams.city')}>
                  <TextField {...field} fullWidth size="small" disabled={saving} />
                </Field>
              )} />
            </Grid>
            <Grid size={12}>
              <Controller name="description" control={control} render={({ field }) => (
                <Field label={t('teams.description')}>
                  <TextField {...field} fullWidth size="small" multiline minRows={2} maxRows={4} disabled={saving} />
                </Field>
              )} />
            </Grid>
          </Grid>
        </form>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={handleClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button variant="contained" type="submit" form="team-form" disabled={saving}>
          {saving ? t('common.saving') : isEdit ? t('common.save') : t('common.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
