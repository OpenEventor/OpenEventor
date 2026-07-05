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
import { api } from '../../../api/client.ts';
import type { Team } from '../../../api/types.ts';

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
                <TextField {...field} label={t('common.name')} required fullWidth size="small" error={!!errors.name} helperText={errors.name?.message as string} disabled={saving} autoFocus />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="country" control={control} render={({ field }) => (
                <TextField {...field} label={t('teams.country')} fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="region" control={control} render={({ field }) => (
                <TextField {...field} label={t('teams.region')} fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="city" control={control} render={({ field }) => (
                <TextField {...field} label={t('teams.city')} fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={12}>
              <Controller name="description" control={control} render={({ field }) => (
                <TextField {...field} label={t('teams.description')} fullWidth size="small" multiline minRows={2} maxRows={4} disabled={saving} />
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
