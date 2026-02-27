import { useEffect, useState } from 'react';
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

const schema = Joi.object<TeamFormData>({
  name: Joi.string().required().messages({ 'string.empty': 'Name is required' }),
  country: Joi.string().allow('').optional(),
  region: Joi.string().allow('').optional(),
  city: Joi.string().allow('').optional(),
  description: Joi.string().allow('').optional(),
});

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
  const isEdit = Boolean(team);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => { if (!saving) onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
        {isEdit ? 'Edit team' : 'New team'}
        <IconButton size="small" onClick={handleClose} disabled={saving}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form id="team-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Grid container spacing={1.5}>
            <Grid size={12}>
              <Controller name="name" control={control} render={({ field }) => (
                <TextField {...field} label="Name" required fullWidth size="small" error={!!errors.name} helperText={errors.name?.message as string} disabled={saving} autoFocus />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="country" control={control} render={({ field }) => (
                <TextField {...field} label="Country" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="region" control={control} render={({ field }) => (
                <TextField {...field} label="Region" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="city" control={control} render={({ field }) => (
                <TextField {...field} label="City" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={12}>
              <Controller name="description" control={control} render={({ field }) => (
                <TextField {...field} label="Description" fullWidth size="small" multiline minRows={2} maxRows={4} disabled={saving} />
              )} />
            </Grid>
          </Grid>
        </form>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" type="submit" form="team-form" disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
