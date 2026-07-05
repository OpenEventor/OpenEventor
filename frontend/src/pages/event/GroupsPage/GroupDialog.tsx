import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { joiResolver } from '@hookform/resolvers/joi';
import Joi from 'joi';
import {
  Alert,
  Autocomplete,
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
import type { Group, Course } from '../../../api/types.ts';
import Field from '../../../components/Field/Field.tsx';
import TimeInput from '../../../components/Time/TimeInput.tsx';
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

interface PickerOption {
  id: string;
  name: string;
}

// Relational picker: displays the entity name, stores its id ("" = none).
// Falls back to a synthetic option so a stale/unknown id is never silently lost.
function EntityPicker({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: PickerOption[];
  disabled?: boolean;
}) {
  const opts =
    value && !options.some((o) => o.id === value)
      ? [...options, { id: value, name: value }]
      : options;
  const selected = opts.find((o) => o.id === value) ?? null;
  return (
    <Field label={label}>
      <Autocomplete
        size="small"
        options={opts}
        getOptionLabel={(o) => o.name}
        isOptionEqualToValue={(o, v) => o.id === v.id}
        value={selected}
        onChange={(_, v) => onChange(v ? v.id : '')}
        disabled={disabled}
        fullWidth
        renderInput={(params) => <TextField {...params} placeholder={label} />}
      />
    </Field>
  );
}

// Self + entire descendant subtree of `rootId` — the groups that must NOT be
// offered as a parent (picking any of them would create a cycle).
function collectExcludedParentIds(rootId: string, groups: Group[]): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const g of groups) {
    if (!g.parentId) continue;
    const arr = childrenOf.get(g.parentId) ?? [];
    arr.push(g.id);
    childrenOf.set(g.parentId, arr);
  }
  const excluded = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop() as string;
    for (const child of childrenOf.get(cur) ?? []) {
      if (!excluded.has(child)) {
        excluded.add(child);
        stack.push(child);
      }
    }
  }
  return excluded;
}

// Scoring-course name inherited from a parent: walk the parent chain (cycle-safe)
// to the first ancestor that defines its own course.
function resolveInheritedCourseName(
  parentId: string,
  groupsById: Map<string, Group>,
  coursesById: Map<string, Course>,
): string {
  const seen = new Set<string>();
  let g: Group | undefined = groupsById.get(parentId);
  while (g && !seen.has(g.id)) {
    seen.add(g.id);
    if (g.courseId) return coursesById.get(g.courseId)?.name ?? g.courseId;
    g = g.parentId ? groupsById.get(g.parentId) : undefined;
  }
  return '';
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 600, color: 'text.secondary', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {children}
    </Typography>
  );
}

export function GroupDialog({ open, onClose, onSaved, eventId, group }: GroupDialogProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(group);
  const { date: baseDate, timezone } = useEvent();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const schema = useMemo(() => Joi.object<GroupFormData>({
    name: Joi.string().required().messages({ 'string.empty': t('groups.nameRequired') }),
    courseId: Joi.string().allow('').optional(),
    parentId: Joi.string().allow('').optional(),
    gender: Joi.string().allow('', 'M', 'F').optional(),
    yearFrom: Joi.alternatives().try(Joi.number().integer().min(1900), Joi.string().valid('')).optional(),
    yearTo: Joi.alternatives().try(Joi.number().integer().min(1900), Joi.string().valid('')).optional(),
    startTime: Joi.number().min(0).optional(),
    price: Joi.alternatives().try(Joi.number().min(0), Joi.string().valid('')).optional(),
    description: Joi.string().allow('').optional(),
    sortOrder: Joi.alternatives().try(Joi.number().integer(), Joi.string().valid('')).optional(),
  }), [t]);

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<GroupFormData>({
    resolver: joiResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(group ? groupToForm(group) : DEFAULT_VALUES);
      setError(null);
    }
  }, [open, group, reset]);

  // Groups (for cycle-safe parent options + inherited-course preview) and courses.
  useEffect(() => {
    if (!open || !eventId) return;
    Promise.all([
      api.get<Group[]>(`/api/events/${eventId}/groups`),
      api.get<Course[]>(`/api/events/${eventId}/courses`),
    ])
      .then(([g, c]) => { setAllGroups(g); setCourses(c); })
      .catch(() => { /* non-critical */ });
  }, [open, eventId]);

  const courseId = watch('courseId');
  const parentId = watch('parentId');

  const groupsById = useMemo(() => new Map(allGroups.map((g) => [g.id, g])), [allGroups]);
  const coursesById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  // Parent options exclude the group itself and its whole descendant subtree.
  const parentOptions = useMemo(() => {
    if (!group?.id) return allGroups;
    const excluded = collectExcludedParentIds(group.id, allGroups);
    return allGroups.filter((g) => !excluded.has(g.id));
  }, [allGroups, group?.id]);

  const inheritedCourseName = parentId
    ? resolveInheritedCourseName(parentId, groupsById, coursesById)
    : '';

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
      setError(err instanceof Error ? err.message : t('groups.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => { if (!saving) onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
        {isEdit ? t('groups.editTitle') : t('groups.newTitle')}
        <IconButton size="small" onClick={handleClose} disabled={saving}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form id="group-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Basic */}
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="name" control={control} render={({ field }) => (
                <Field label={t('common.name')} required error={!!errors.name}>
                  <TextField {...field} required fullWidth size="small" error={!!errors.name} helperText={errors.name?.message as string} disabled={saving} autoFocus />
                </Field>
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Controller name="gender" control={control} render={({ field }) => (
                <Field label={t('groups.gender')}>
                  <TextField {...field} fullWidth size="small" select disabled={saving}>
                    <MenuItem value="">—</MenuItem>
                    <MenuItem value="M">M</MenuItem>
                    <MenuItem value="F">F</MenuItem>
                  </TextField>
                </Field>
              )} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Controller name="sortOrder" control={control} render={({ field }) => (
                <Field label={t('groups.sortOrder')}>
                  <TextField {...field} fullWidth size="small" type="number" disabled={saving} />
                </Field>
              )} />
            </Grid>
          </Grid>

          {/* Age range */}
          <SectionTitle>{t('groups.ageRange')}</SectionTitle>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 6 }}>
              <Controller name="yearFrom" control={control} render={({ field }) => (
                <Field label={t('groups.yearFrom')}>
                  <TextField {...field} fullWidth size="small" type="number" disabled={saving} />
                </Field>
              )} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Controller name="yearTo" control={control} render={({ field }) => (
                <Field label={t('groups.yearTo')}>
                  <TextField {...field} fullWidth size="small" type="number" disabled={saving} />
                </Field>
              )} />
            </Grid>
          </Grid>

          {/* Scoring: course XOR parent (mutually exclusive) */}
          <SectionTitle>{t('groups.links')}</SectionTitle>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="courseId" control={control} render={({ field }) => (
                <EntityPicker
                  label={t('groups.course')}
                  value={field.value}
                  onChange={(id) => { field.onChange(id); if (id) setValue('parentId', ''); }}
                  options={courses}
                  disabled={saving || !!parentId}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="parentId" control={control} render={({ field }) => (
                <EntityPicker
                  label={t('groups.parentGroup')}
                  value={field.value}
                  onChange={(id) => { field.onChange(id); if (id) setValue('courseId', ''); }}
                  options={parentOptions}
                  disabled={saving || !!courseId}
                />
              )} />
            </Grid>
            {parentId && (
              <Grid size={12}>
                <Field label={t('groups.scoringFromParent')}>
                  <TextField
                    value={inheritedCourseName || t('common.none')}
                    fullWidth
                    size="small"
                    disabled={saving}
                    slotProps={{ input: { readOnly: true } }}
                  />
                </Field>
              </Grid>
            )}
            <Grid size={12}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t('groups.inheritanceFooter')}
              </Typography>
            </Grid>
          </Grid>

          {/* Settings */}
          <SectionTitle>{t('groups.settings')}</SectionTitle>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="startTime" control={control} render={({ field }) => (
                <Field label={t('groups.startTime')}>
                  <TimeInput
                    value={field.value || null}
                    baseDate={baseDate}
                    timezone={timezone}
                    onChange={(ts) => field.onChange(ts ?? 0)}
                    size="small"
                    disabled={saving}
                    fullWidth
                  />
                </Field>
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="price" control={control} render={({ field }) => (
                <Field label={t('groups.price')}>
                  <TextField {...field} fullWidth size="small" type="number" disabled={saving} />
                </Field>
              )} />
            </Grid>
          </Grid>

          {/* Description */}
          <SectionTitle>{t('groups.description')}</SectionTitle>
          <Controller name="description" control={control} render={({ field }) => (
            <Field label={t('groups.description')}>
              <TextField {...field} fullWidth size="small" multiline minRows={2} maxRows={4} disabled={saving} />
            </Field>
          )} />
        </form>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={handleClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button variant="contained" type="submit" form="group-form" disabled={saving}>
          {saving ? t('common.saving') : isEdit ? t('common.save') : t('common.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
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
