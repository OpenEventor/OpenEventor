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
import type { Group } from '../../../api/types.ts';
import TimeInput from '../../../components/TimeInput.tsx';
import { useEvent } from '../../../contexts/EventContext.tsx';

interface GroupFormData {
  name: string;
  courseId: string;
  parentId: string;
  gender: string;
  yearFrom: number | '';
  yearTo: number | '';
  startTime: number;
  price: number | '';
  description: string;
  sortOrder: number | '';
}

const schema = Joi.object<GroupFormData>({
  name: Joi.string().required().messages({ 'string.empty': 'Name is required' }),
  courseId: Joi.string().allow('').optional(),
  parentId: Joi.string().allow('').optional(),
  gender: Joi.string().allow('', 'M', 'F').optional(),
  yearFrom: Joi.alternatives().try(Joi.number().integer().min(1900), Joi.string().valid('')).optional(),
  yearTo: Joi.alternatives().try(Joi.number().integer().min(1900), Joi.string().valid('')).optional(),
  startTime: Joi.number().min(0).optional(),
  price: Joi.alternatives().try(Joi.number().min(0), Joi.string().valid('')).optional(),
  description: Joi.string().allow('').optional(),
  sortOrder: Joi.alternatives().try(Joi.number().integer(), Joi.string().valid('')).optional(),
});

const DEFAULT_VALUES: GroupFormData = {
  name: '', courseId: '', parentId: '', gender: '',
  yearFrom: '', yearTo: '', startTime: 0, price: '', description: '', sortOrder: '',
};

interface GroupDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  eventId: string;
  group?: Group | null;
}

function groupToForm(g: Group): GroupFormData {
  return {
    name: g.name, courseId: g.courseId, parentId: g.parentId, gender: g.gender,
    yearFrom: g.yearFrom || '', yearTo: g.yearTo || '',
    startTime: g.startTime || 0, price: g.price || '', description: g.description,
    sortOrder: g.sortOrder || '',
  };
}

function formToPayload(data: GroupFormData) {
  return {
    ...data,
    yearFrom: data.yearFrom === '' ? 0 : Number(data.yearFrom),
    yearTo: data.yearTo === '' ? 0 : Number(data.yearTo),
    startTime: data.startTime || 0,
    price: data.price === '' ? 0 : Number(data.price),
    sortOrder: data.sortOrder === '' ? 0 : Number(data.sortOrder),
  };
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 600, color: 'text.secondary', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {children}
    </Typography>
  );
}

export function GroupDialog({ open, onClose, onSaved, eventId, group }: GroupDialogProps) {
  const isEdit = Boolean(group);
  const { date: baseDate, timezone } = useEvent();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<GroupFormData>({
    resolver: joiResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(group ? groupToForm(group) : DEFAULT_VALUES);
      setError(null);
    }
  }, [open, group, reset]);

  const onSubmit = async (data: GroupFormData) => {
    setSaving(true);
    setError(null);
    try {
      const payload = formToPayload(data);
      if (isEdit && group) {
        await api.put(`/api/events/${eventId}/groups/${group.id}`, payload);
      } else {
        await api.post(`/api/events/${eventId}/groups`, payload);
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
        {isEdit ? 'Edit group' : 'New group'}
        <IconButton size="small" onClick={handleClose} disabled={saving}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form id="group-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Basic */}
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="name" control={control} render={({ field }) => (
                <TextField {...field} label="Name" required fullWidth size="small" error={!!errors.name} helperText={errors.name?.message as string} disabled={saving} autoFocus />
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Controller name="gender" control={control} render={({ field }) => (
                <TextField {...field} label="Gender" fullWidth size="small" select disabled={saving}>
                  <MenuItem value="">—</MenuItem>
                  <MenuItem value="M">M</MenuItem>
                  <MenuItem value="F">F</MenuItem>
                </TextField>
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Controller name="sortOrder" control={control} render={({ field }) => (
                <TextField {...field} label="Sort order" fullWidth size="small" type="number" disabled={saving} />
              )} />
            </Grid>
          </Grid>

          {/* Age range */}
          <SectionTitle>Age range</SectionTitle>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 6 }}>
              <Controller name="yearFrom" control={control} render={({ field }) => (
                <TextField {...field} label="Year from" fullWidth size="small" type="number" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Controller name="yearTo" control={control} render={({ field }) => (
                <TextField {...field} label="Year to" fullWidth size="small" type="number" disabled={saving} />
              )} />
            </Grid>
          </Grid>

          {/* Links */}
          <SectionTitle>Links</SectionTitle>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="courseId" control={control} render={({ field }) => (
                <TextField {...field} label="Course ID" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="parentId" control={control} render={({ field }) => (
                <TextField {...field} label="Parent group ID" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
          </Grid>

          {/* Settings */}
          <SectionTitle>Settings</SectionTitle>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="startTime" control={control} render={({ field }) => (
                <TimeInput
                  value={field.value || null}
                  baseDate={baseDate}
                  timezone={timezone}
                  onChange={(ts) => field.onChange(ts ?? 0)}
                  label="Start time"
                  size="small"
                  disabled={saving}
                  fullWidth
                />
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
        <Button variant="contained" type="submit" form="group-form" disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
