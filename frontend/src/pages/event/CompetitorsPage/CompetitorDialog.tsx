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
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { api } from '../../../api/client.ts';
import type { Competitor } from '../../../api/types.ts';

interface CompetitorFormData {
  bib: string;
  card1: string;
  card2: string;
  teamId: string;
  groupId: string;
  courseId: string;
  firstName: string;
  lastName: string;
  middleName: string;
  firstNameInt: string;
  lastNameInt: string;
  gender: string;
  birthDate: string;
  birthYear: number | '';
  rank: string;
  rating: number | '';
  country: string;
  region: string;
  city: string;
  phone: string;
  email: string;
  startTime: string;
  timeAdjustment: number | '';
  dsq: number;
  dsqDescription: string;
  dns: number;
  dnf: number;
  outOfRank: number;
  entryNumber: string;
  price: number | '';
  isPaid: number;
  isCheckin: number;
  notes: string;
}

const schema = Joi.object<CompetitorFormData>({
  lastName: Joi.string().required().messages({ 'string.empty': 'Last name is required' }),
  firstName: Joi.string().allow('').optional(),
  middleName: Joi.string().allow('').optional(),
  firstNameInt: Joi.string().allow('').optional(),
  lastNameInt: Joi.string().allow('').optional(),
  bib: Joi.string().allow('').optional(),
  card1: Joi.string().allow('').optional(),
  card2: Joi.string().allow('').optional(),
  teamId: Joi.string().allow('').optional(),
  groupId: Joi.string().allow('').optional(),
  courseId: Joi.string().allow('').optional(),
  gender: Joi.string().allow('', 'M', 'F').optional(),
  birthDate: Joi.string().allow('').optional(),
  birthYear: Joi.alternatives().try(
    Joi.number().integer().min(1900).max(new Date().getFullYear()),
    Joi.string().valid(''),
  ).optional(),
  rank: Joi.string().allow('').optional(),
  rating: Joi.alternatives().try(
    Joi.number().min(0),
    Joi.string().valid(''),
  ).optional(),
  country: Joi.string().allow('').optional(),
  region: Joi.string().allow('').optional(),
  city: Joi.string().allow('').optional(),
  phone: Joi.string().allow('').optional(),
  email: Joi.string().allow('').email({ tlds: false }).optional().messages({
    'string.email': 'Invalid email format',
  }),
  startTime: Joi.string().allow('').optional(),
  timeAdjustment: Joi.alternatives().try(
    Joi.number().integer(),
    Joi.string().valid(''),
  ).optional(),
  dsq: Joi.number().valid(0, 1).optional(),
  dsqDescription: Joi.string().allow('').optional(),
  dns: Joi.number().valid(0, 1).optional(),
  dnf: Joi.number().valid(0, 1).optional(),
  outOfRank: Joi.number().valid(0, 1).optional(),
  entryNumber: Joi.string().allow('').optional(),
  price: Joi.alternatives().try(
    Joi.number().min(0),
    Joi.string().valid(''),
  ).optional(),
  isPaid: Joi.number().valid(0, 1).optional(),
  isCheckin: Joi.number().valid(0, 1).optional(),
  notes: Joi.string().allow('').optional(),
});

const DEFAULT_VALUES: CompetitorFormData = {
  bib: '', card1: '', card2: '', teamId: '', groupId: '', courseId: '',
  firstName: '', lastName: '', middleName: '',
  firstNameInt: '', lastNameInt: '',
  gender: '', birthDate: '', birthYear: '',
  rank: '', rating: '',
  country: '', region: '', city: '',
  phone: '', email: '',
  startTime: '', timeAdjustment: '',
  dsq: 0, dsqDescription: '', dns: 0, dnf: 0, outOfRank: 0,
  entryNumber: '', price: '', isPaid: 0, isCheckin: 0,
  notes: '',
};

interface CompetitorDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  eventId: string;
  competitor?: Competitor | null;
}

function competitorToForm(c: Competitor): CompetitorFormData {
  return {
    ...c,
    birthYear: c.birthYear || '',
    rating: c.rating || '',
    timeAdjustment: c.timeAdjustment || '',
    price: c.price || '',
  };
}

function formToPayload(data: CompetitorFormData) {
  return {
    ...data,
    birthYear: data.birthYear === '' ? 0 : Number(data.birthYear),
    rating: data.rating === '' ? 0 : Number(data.rating),
    timeAdjustment: data.timeAdjustment === '' ? 0 : Number(data.timeAdjustment),
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

export function CompetitorDialog({ open, onClose, onSaved, eventId, competitor }: CompetitorDialogProps) {
  const isEdit = Boolean(competitor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<CompetitorFormData>({
    resolver: joiResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(competitor ? competitorToForm(competitor) : DEFAULT_VALUES);
      setError(null);
    }
  }, [open, competitor, reset]);

  const onSubmit = async (data: CompetitorFormData) => {
    setSaving(true);
    setError(null);
    try {
      const payload = formToPayload(data);
      if (isEdit && competitor) {
        await api.put(`/api/events/${eventId}/competitors/${competitor.id}`, payload);
      } else {
        await api.post(`/api/events/${eventId}/competitors`, payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
        {isEdit ? 'Edit competitor' : 'New competitor'}
        <IconButton size="small" onClick={handleClose} disabled={saving}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <form id="competitor-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Personal */}
          <SectionTitle>Personal</SectionTitle>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="lastName" control={control} render={({ field }) => (
                <TextField {...field} label="Last name" required fullWidth size="small" error={!!errors.lastName} helperText={errors.lastName?.message as string} disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="firstName" control={control} render={({ field }) => (
                <TextField {...field} label="First name" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="middleName" control={control} render={({ field }) => (
                <TextField {...field} label="Middle name" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Controller name="gender" control={control} render={({ field }) => (
                <TextField {...field} label="Gender" fullWidth size="small" select disabled={saving}>
                  <MenuItem value="">—</MenuItem>
                  <MenuItem value="M">M</MenuItem>
                  <MenuItem value="F">F</MenuItem>
                </TextField>
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Controller name="birthDate" control={control} render={({ field }) => (
                <TextField {...field} label="Birth date" fullWidth size="small" placeholder="YYYY-MM-DD" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Controller name="birthYear" control={control} render={({ field }) => (
                <TextField {...field} label="Birth year" fullWidth size="small" type="number" error={!!errors.birthYear} helperText={errors.birthYear?.message as string} disabled={saving} />
              )} />
            </Grid>
          </Grid>

          {/* International name */}
          <SectionTitle>International name</SectionTitle>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="lastNameInt" control={control} render={({ field }) => (
                <TextField {...field} label="Last name (int)" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="firstNameInt" control={control} render={({ field }) => (
                <TextField {...field} label="First name (int)" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
          </Grid>

          {/* Competition */}
          <SectionTitle>Competition</SectionTitle>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Controller name="bib" control={control} render={({ field }) => (
                <TextField {...field} label="Bib" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Controller name="card1" control={control} render={({ field }) => (
                <TextField {...field} label="Card 1" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Controller name="card2" control={control} render={({ field }) => (
                <TextField {...field} label="Card 2" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="teamId" control={control} render={({ field }) => (
                <TextField {...field} label="Team ID" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Controller name="groupId" control={control} render={({ field }) => (
                <TextField {...field} label="Group ID" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Controller name="courseId" control={control} render={({ field }) => (
                <TextField {...field} label="Course ID" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Controller name="rank" control={control} render={({ field }) => (
                <TextField {...field} label="Rank" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Controller name="rating" control={control} render={({ field }) => (
                <TextField {...field} label="Rating" fullWidth size="small" type="number" error={!!errors.rating} helperText={errors.rating?.message as string} disabled={saving} />
              )} />
            </Grid>
          </Grid>

          {/* Location */}
          <SectionTitle>Location</SectionTitle>
          <Grid container spacing={1.5}>
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
          </Grid>

          {/* Contact */}
          <SectionTitle>Contact</SectionTitle>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="phone" control={control} render={({ field }) => (
                <TextField {...field} label="Phone" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="email" control={control} render={({ field }) => (
                <TextField {...field} label="Email" fullWidth size="small" error={!!errors.email} helperText={errors.email?.message as string} disabled={saving} />
              )} />
            </Grid>
          </Grid>

          {/* Start */}
          <SectionTitle>Start</SectionTitle>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="startTime" control={control} render={({ field }) => (
                <TextField {...field} label="Start time" fullWidth size="small" placeholder="HH:MM:SS" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="timeAdjustment" control={control} render={({ field }) => (
                <TextField {...field} label="Time adjustment (sec)" fullWidth size="small" type="number" disabled={saving} />
              )} />
            </Grid>
          </Grid>

          {/* Status */}
          <SectionTitle>Status</SectionTitle>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Controller name="dsq" control={control} render={({ field }) => (
                <FormControlLabel control={<Checkbox checked={field.value === 1} onChange={(_, checked) => field.onChange(checked ? 1 : 0)} size="small" disabled={saving} />} label="DSQ" />
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Controller name="dns" control={control} render={({ field }) => (
                <FormControlLabel control={<Checkbox checked={field.value === 1} onChange={(_, checked) => field.onChange(checked ? 1 : 0)} size="small" disabled={saving} />} label="DNS" />
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Controller name="dnf" control={control} render={({ field }) => (
                <FormControlLabel control={<Checkbox checked={field.value === 1} onChange={(_, checked) => field.onChange(checked ? 1 : 0)} size="small" disabled={saving} />} label="DNF" />
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Controller name="outOfRank" control={control} render={({ field }) => (
                <FormControlLabel control={<Checkbox checked={field.value === 1} onChange={(_, checked) => field.onChange(checked ? 1 : 0)} size="small" disabled={saving} />} label="Out of rank" />
              )} />
            </Grid>
            <Grid size={12}>
              <Controller name="dsqDescription" control={control} render={({ field }) => (
                <TextField {...field} label="DSQ description" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
          </Grid>

          {/* Entry */}
          <SectionTitle>Entry</SectionTitle>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Controller name="entryNumber" control={control} render={({ field }) => (
                <TextField {...field} label="Entry number" fullWidth size="small" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Controller name="price" control={control} render={({ field }) => (
                <TextField {...field} label="Price" fullWidth size="small" type="number" error={!!errors.price} helperText={errors.price?.message as string} disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 2 }}>
              <Controller name="isPaid" control={control} render={({ field }) => (
                <FormControlLabel control={<Checkbox checked={field.value === 1} onChange={(_, checked) => field.onChange(checked ? 1 : 0)} size="small" disabled={saving} />} label="Paid" />
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 2 }}>
              <Controller name="isCheckin" control={control} render={({ field }) => (
                <FormControlLabel control={<Checkbox checked={field.value === 1} onChange={(_, checked) => field.onChange(checked ? 1 : 0)} size="small" disabled={saving} />} label="Check-in" />
              )} />
            </Grid>
          </Grid>

          {/* Notes */}
          <SectionTitle>Notes</SectionTitle>
          <Controller name="notes" control={control} render={({ field }) => (
            <TextField {...field} label="Notes" fullWidth size="small" multiline minRows={2} maxRows={4} disabled={saving} />
          )} />
        </form>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" type="submit" form="competitor-form" disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
