import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { joiResolver } from '@hookform/resolvers/joi';
import Joi from 'joi';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  DeleteOutlined as DeleteIcon,
} from '@mui/icons-material';
import { api } from '../../../api/client.ts';
import type { Course, Checkpoint } from '../../../api/types.ts';
import TimeInput from '../../../components/Time/TimeInput.tsx';
import { useEvent } from '../../../contexts/EventContext.tsx';

interface CourseFormData {
  name: string;
  checkpoints: string;
  validationMode: string;
  geoTrack: string;
  length: number | '';
  altitude: number | '';
  climb: number | '';
  startTime: number;
  price: number | '';
  description: string;
}

const DEFAULT_VALUES: CourseFormData = {
  name: '', checkpoints: '', validationMode: 'strict', geoTrack: '',
  length: '', altitude: '', climb: '', startTime: 0, price: '', description: '',
};

interface CourseDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  eventId: string;
  course?: Course | null;
}

// Parses the stored `checkpoints` JSON string into an ordered list of names.
// A name may repeat (a lap). Invalid/empty input yields an empty sequence.
function parseCheckpoints(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.filter((v): v is string => typeof v === 'string')
      : [];
  } catch {
    return [];
  }
}

function courseToForm(c: Course): CourseFormData {
  return {
    name: c.name, checkpoints: c.checkpoints, validationMode: c.validationMode,
    geoTrack: c.geoTrack, length: c.length || '', altitude: c.altitude || '',
    climb: c.climb || '', startTime: c.startTime || 0, price: c.price || '', description: c.description,
  };
}

function formToPayload(data: CourseFormData) {
  return {
    ...data,
    length: data.length === '' ? 0 : Number(data.length),
    altitude: data.altitude === '' ? 0 : Number(data.altitude),
    climb: data.climb === '' ? 0 : Number(data.climb),
    startTime: data.startTime || 0,
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
  const { t } = useTranslation();
  const isEdit = Boolean(course);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { date: baseDate, timezone } = useEvent();

  const schema = useMemo(() => Joi.object<CourseFormData>({
    name: Joi.string().required().messages({ 'string.empty': t('common.nameRequired') }),
    checkpoints: Joi.string().allow('').optional(),
    validationMode: Joi.string().allow('', 'strict', 'relaxed').optional(),
    geoTrack: Joi.string().allow('').optional(),
    length: Joi.alternatives().try(Joi.number().min(0), Joi.string().valid('')).optional(),
    altitude: Joi.alternatives().try(Joi.number().min(0), Joi.string().valid('')).optional(),
    climb: Joi.alternatives().try(Joi.number().min(0), Joi.string().valid('')).optional(),
    startTime: Joi.number().min(0).optional(),
    price: Joi.alternatives().try(Joi.number().min(0), Joi.string().valid('')).optional(),
    description: Joi.string().allow('').optional(),
  }), [t]);

  // Ordered checkpoint-name sequence built by the user (source of truth for the
  // `checkpoints` form field, which stores it as a JSON string array of names).
  const [sequence, setSequence] = useState<string[]>([]);
  const [checkpointNames, setCheckpointNames] = useState<string[]>([]);
  const [addInput, setAddInput] = useState('');

  const { control, handleSubmit, reset, setValue, formState: { errors } } = useForm<CourseFormData>({
    resolver: joiResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(course ? courseToForm(course) : DEFAULT_VALUES);
      setSequence(parseCheckpoints(course?.checkpoints ?? ''));
      setAddInput('');
      setError(null);
    }
  }, [open, course, reset]);

  // Load existing checkpoint names for the add-control suggestions.
  useEffect(() => {
    if (!open || !eventId) return;
    api
      .get<Checkpoint[]>(`/api/events/${eventId}/checkpoints`)
      .then((data) => {
        const names = Array.from(new Set(data.map((c) => c.name).filter(Boolean)));
        setCheckpointNames(names);
      })
      .catch(() => setCheckpointNames([]));
  }, [open, eventId]);

  // Keep the form's `checkpoints` string in sync with the visual sequence.
  useEffect(() => {
    setValue('checkpoints', sequence.length ? JSON.stringify(sequence) : '');
  }, [sequence, setValue]);

  const addCheckpoint = (name: string) => {
    const n = name.trim();
    if (!n) return;
    setSequence((prev) => [...prev, n]);
    setAddInput('');
  };

  const moveCheckpoint = (index: number, dir: -1 | 1) => {
    setSequence((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const removeCheckpoint = (index: number) => {
    setSequence((prev) => prev.filter((_, i) => i !== index));
  };

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
      setError(err instanceof Error ? err.message : t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => { if (!saving) onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
        {isEdit ? t('courses.dialog.editTitle') : t('courses.dialog.newTitle')}
        <IconButton size="small" onClick={handleClose} disabled={saving}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form id="course-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Basic */}
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <Controller name="name" control={control} render={({ field }) => (
                <TextField {...field} label={t('common.name')} required fullWidth size="small" error={!!errors.name} helperText={errors.name?.message as string} disabled={saving} autoFocus />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="validationMode" control={control} render={({ field }) => (
                <TextField {...field} label={t('courses.columns.validation')} fullWidth size="small" select disabled={saving}>
                  <MenuItem value="strict">{t('courses.dialog.strict')}</MenuItem>
                  <MenuItem value="relaxed">{t('courses.dialog.relaxed')}</MenuItem>
                </TextField>
              )} />
            </Grid>
          </Grid>

          {/* Checkpoints */}
          <SectionTitle>{t('courses.dialog.checkpoints')}</SectionTitle>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <Autocomplete
              freeSolo
              size="small"
              options={checkpointNames}
              value={null}
              inputValue={addInput}
              onInputChange={(_, v) => setAddInput(v)}
              onChange={(_, v) => { if (typeof v === 'string') addCheckpoint(v); }}
              disabled={saving}
              sx={{ flex: 1 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('courses.dialog.addCheckpoint')}
                  placeholder={t('courses.dialog.addCheckpointPlaceholder')}
                />
              )}
            />
            <Button
              variant="outlined"
              size="small"
              sx={{ height: 40 }}
              onClick={() => addCheckpoint(addInput)}
              disabled={saving || !addInput.trim()}
            >
              {t('common.add')}
            </Button>
          </Stack>
          {sequence.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
              {t('courses.dialog.noCheckpoints')}
            </Typography>
          ) : (
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {sequence.map((name, i) => (
                <Box
                  key={`${name}-${i}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" sx={{ color: 'text.secondary', width: 24, textAlign: 'right' }}>
                    {i + 1}.
                  </Typography>
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                    {name}
                  </Typography>
                  <IconButton size="small" disabled={saving || i === 0} onClick={() => moveCheckpoint(i, -1)}>
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" disabled={saving || i === sequence.length - 1} onClick={() => moveCheckpoint(i, 1)}>
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" disabled={saving} onClick={() => removeCheckpoint(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          )}

          {/* Track */}
          <SectionTitle>{t('courses.dialog.track')}</SectionTitle>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 4 }}>
              <Controller name="length" control={control} render={({ field }) => (
                <TextField {...field} label={t('courses.dialog.length')} fullWidth size="small" type="number" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Controller name="altitude" control={control} render={({ field }) => (
                <TextField {...field} label={t('courses.dialog.altitude')} fullWidth size="small" type="number" disabled={saving} />
              )} />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Controller name="climb" control={control} render={({ field }) => (
                <TextField {...field} label={t('courses.dialog.climb')} fullWidth size="small" type="number" disabled={saving} />
              )} />
            </Grid>
          </Grid>

          {/* Settings */}
          <SectionTitle>{t('courses.dialog.settings')}</SectionTitle>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="startTime" control={control} render={({ field }) => (
                <TimeInput
                  value={field.value || null}
                  baseDate={baseDate}
                  timezone={timezone}
                  onChange={(ts) => field.onChange(ts ?? 0)}
                  label={t('courses.dialog.startTime')}
                  size="small"
                  disabled={saving}
                  fullWidth
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="price" control={control} render={({ field }) => (
                <TextField {...field} label={t('courses.dialog.price')} fullWidth size="small" type="number" disabled={saving} />
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
        <Button variant="contained" type="submit" form="course-form" disabled={saving}>
          {saving ? t('common.saving') : isEdit ? t('common.save') : t('common.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
