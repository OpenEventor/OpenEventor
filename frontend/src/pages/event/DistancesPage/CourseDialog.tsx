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
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { api } from '../../../api/client.ts';
import type { Course } from '../../../api/types.ts';

interface CourseFormData {
  name: string;
  checkpoints: string;
  validationMode: string;
  geoTrack: string;
  length: number | '';
  altitude: number | '';
  climb: number | '';
  startTime: string;
  price: number | '';
  description: string;
}

const schema = Joi.object<CourseFormData>({
  name: Joi.string().required().messages({ 'string.empty': 'Name is required' }),
  checkpoints: Joi.string().allow('').optional(),
  validationMode: Joi.string().allow('', 'strict', 'relaxed').optional(),
  geoTrack: Joi.string().allow('').optional(),
  length: Joi.alternatives().try(Joi.number().min(0), Joi.string().valid('')).optional(),
  altitude: Joi.alternatives().try(Joi.number().min(0), Joi.string().valid('')).optional(),
  climb: Joi.alternatives().try(Joi.number().min(0), Joi.string().valid('')).optional(),
  startTime: Joi.string().allow('').optional(),
  price: Joi.alternatives().try(Joi.number().min(0), Joi.string().valid('')).optional(),
  description: Joi.string().allow('').optional(),
});

const DEFAULT_VALUES: CourseFormData = {
  name: '', checkpoints: '', validationMode: 'strict', geoTrack: '',
  length: '', altitude: '', climb: '', startTime: '', price: '', description: '',
};

interface CourseDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  eventId: string;
  course?: Course | null;
}

function courseToForm(c: Course): CourseFormData {
  return {
    name: c.name, checkpoints: c.checkpoints, validationMode: c.validationMode,
    geoTrack: c.geoTrack, length: c.length || '', altitude: c.altitude || '',
    climb: c.climb || '', startTime: c.startTime, price: c.price || '', description: c.description,
  };
}

function formToPayload(data: CourseFormData) {
  return {
    ...data,
    length: data.length === '' ? 0 : Number(data.length),
    altitude: data.altitude === '' ? 0 : Number(data.altitude),
    climb: data.climb === '' ? 0 : Number(data.climb),
    price: data.price === '' ? 0 : Number(data.price),
  };
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 600, color: 'text.secondary', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {children}
    </Typography>
  );
}

export function CourseDialog({ open, onClose, onSaved, eventId, course }: CourseDialogProps) {
  const isEdit = Boolean(course);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<CourseFormData>({
    resolver: joiResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(course ? courseToForm(course) : DEFAULT_VALUES);
      setError(null);
    }
  }, [open, course, reset]);

  const onSubmit = async (data: CourseFormData) => {
    setSaving(true);
    setError(null);
    try {
      const payload = formToPayload(data);
      if (isEdit && course) {
        await api.put(`/api/events/${eventId}/courses/${course.id}`, payload);
      } else {
        await api.post(`/api/events/${eventId}/courses`, payload);
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
        {isEdit ? 'Edit course' : 'New course'}
        <IconButton size="small" onClick={handleClose} disabled={saving}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form id="course-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Basic */}
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <Controller name="name" control={control} render={({ field }) => (
                <TextField {...field} label="Name" required fullWidth size="small" error={!!errors.name} helperText={errors.name?.message as string} disabled={saving} autoFocus />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="validationMode" control={control} render={({ field }) => (
                <TextField {...field} label="Validation" fullWidth size="small" select disabled={saving}>
                  <MenuItem value="strict">Strict</MenuItem>
                  <MenuItem value="relaxed">Relaxed</MenuItem>
                </TextField>
              )} />
            </Grid>
          </Grid>

          {/* Checkpoints */}
          <SectionTitle>Checkpoints</SectionTitle>
          <Controller name="checkpoints" control={control} render={({ field }) => (
            <TextField {...field} label="Checkpoints (JSON)" fullWidth size="small" multiline minRows={2} maxRows={4} placeholder='["START","31","32","FINISH"]' disabled={saving} />
          )} />

          {/* Track */}
          <SectionTitle>Track</SectionTitle>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 4 }}>
              <Controller name="length" control={control} render={({ field }) => (
                <TextField {...field} label="Length (m)" fullWidth size="small" type="number" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Controller name="altitude" control={control} render={({ field }) => (
                <TextField {...field} label="Altitude (m)" fullWidth size="small" type="number" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Controller name="climb" control={control} render={({ field }) => (
                <TextField {...field} label="Climb (m)" fullWidth size="small" type="number" disabled={saving} />
              )} />
            </Grid>
          </Grid>

          {/* Settings */}
          <SectionTitle>Settings</SectionTitle>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="startTime" control={control} render={({ field }) => (
                <TextField {...field} label="Start time" fullWidth size="small" placeholder="HH:MM:SS" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="price" control={control} render={({ field }) => (
                <TextField {...field} label="Price" fullWidth size="small" type="number" disabled={saving} />
              )} />
            </Grid>
          </Grid>

          {/* Description */}
          <SectionTitle>Description</SectionTitle>
          <Controller name="description" control={control} render={({ field }) => (
            <TextField {...field} label="Description" fullWidth size="small" multiline minRows={2} maxRows={4} disabled={saving} />
          )} />
        </form>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" type="submit" form="course-form" disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
