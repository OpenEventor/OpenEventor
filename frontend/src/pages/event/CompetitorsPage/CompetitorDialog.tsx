import { useEffect, useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { joiResolver } from '@hookform/resolvers/joi';
import Joi from 'joi';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
} from '@mui/icons-material';
import { api } from '../../../api/client.ts';
import type { Competitor, Passing } from '../../../api/types.ts';
import { computeDeltas } from '../../../components/PassingBlock/PassingBlock.tsx';
import InteractivePassingBlock from '../../../components/PassingBlock/InteractivePassingBlock.tsx';
import GapIndicator from '../../../components/GapIndicator/GapIndicator.tsx';
import PassingsEditor from '../../../components/PassingsEditor/PassingsEditor.tsx';

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

export interface CompetitorDialogProps {
  open: boolean;
  mode: 'view' | 'edit' | 'create';
  onClose: () => void;
  onSaved: () => void;
  onEditClick?: () => void;
  eventId: string;
  /** Competitor ID — used to fetch fresh data from API in view mode. */
  competitorId?: string | null;
  /** Full competitor object (used for edit/create form pre-fill). */
  competitor?: Competitor | null;
  /** Show passings section in view mode (default: true). */
  withPassings?: boolean;
}

function competitorToForm(c: Competitor): CompetitorFormData {
  return {
    bib: c.bib, card1: c.card1, card2: c.card2,
    teamId: c.teamId, groupId: c.groupId, courseId: c.courseId,
    firstName: c.firstName, lastName: c.lastName, middleName: c.middleName,
    firstNameInt: c.firstNameInt, lastNameInt: c.lastNameInt,
    gender: c.gender, birthDate: c.birthDate,
    birthYear: c.birthYear || '', rating: c.rating || '',
    rank: c.rank, country: c.country, region: c.region, city: c.city,
    phone: c.phone, email: c.email,
    startTime: c.startTime, timeAdjustment: c.timeAdjustment || '',
    dsq: c.dsq, dsqDescription: c.dsqDescription,
    dns: c.dns, dnf: c.dnf, outOfRank: c.outOfRank,
    entryNumber: c.entryNumber, price: c.price || '',
    isPaid: c.isPaid, isCheckin: c.isCheckin, notes: c.notes,
  };
}

function formToPayload(data: CompetitorFormData) {
  return {
    bib: data.bib, card1: data.card1, card2: data.card2,
    teamId: data.teamId, groupId: data.groupId, courseId: data.courseId,
    firstName: data.firstName, lastName: data.lastName, middleName: data.middleName,
    firstNameInt: data.firstNameInt, lastNameInt: data.lastNameInt,
    gender: data.gender, birthDate: data.birthDate,
    birthYear: data.birthYear === '' ? 0 : Number(data.birthYear),
    rank: data.rank, rating: data.rating === '' ? 0 : Number(data.rating),
    country: data.country, region: data.region, city: data.city,
    phone: data.phone, email: data.email, startTime: data.startTime,
    timeAdjustment: data.timeAdjustment === '' ? 0 : Number(data.timeAdjustment),
    dsq: data.dsq, dsqDescription: data.dsqDescription,
    dns: data.dns, dnf: data.dnf, outOfRank: data.outOfRank,
    entryNumber: data.entryNumber,
    price: data.price === '' ? 0 : Number(data.price),
    isPaid: data.isPaid, isCheckin: data.isCheckin, notes: data.notes,
  };
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 600, color: 'text.secondary', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {children}
    </Typography>
  );
}

// ─── View Mode Helpers ───────────────────────────────────────

function ViewLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>
      {children}
    </Typography>
  );
}

function ViewValue({ children, size = 'normal' }: { children: React.ReactNode; size?: 'normal' | 'large' }) {
  return (
    <Typography sx={{ fontSize: size === 'large' ? '1.1rem' : '0.95rem', wordBreak: 'break-word' }}>
      {children}
    </Typography>
  );
}

function ViewField({ label, value, secondary }: {
  label: string;
  value: string | number | undefined | null;
  secondary?: string;
}) {
  if (!value && value !== 0) return null;
  return (
    <Stack spacing={0}>
      <ViewLabel>{label}</ViewLabel>
      <ViewValue>{String(value)}</ViewValue>
      {secondary && (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
          {secondary}
        </Typography>
      )}
    </Stack>
  );
}

// ─── Passings wrap block ─────────────────────────────────────

function PassingsStrip({ passings, eventId, onMenuAction, onAfterToggle }: {
  passings: Passing[];
  eventId: string;
  onMenuAction: (action: 'edit' | 'add-before' | 'add-after', index: number) => void;
  onAfterToggle: () => void;
}) {
  const deltas = computeDeltas(passings);

  // GapIndicator total width: 6px + 2px margin each side = 10px
  const GAP_W = 10;

  return (
    <Stack spacing={0.5}>
      <ViewLabel>Passings ({passings.length})</ViewLabel>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', rowGap: 0.5, alignItems: 'stretch', pl: `${GAP_W}px` }}>
        {passings.map((p, i) => (
          <Box key={p.id} sx={{ height: 48, display: 'flex', alignItems: 'stretch', ...(i === 0 && { ml: `-${GAP_W}px` }) }}>
            {i === 0 && <GapIndicator onClick={() => onMenuAction('add-before', 0)} />}
            <InteractivePassingBlock
              passing={p}
              delta={deltas[i]}
              eventId={eventId}
              onMenuAction={(action) => onMenuAction(action, i)}
              onAfterToggle={onAfterToggle}
            />
            <GapIndicator onClick={() => onMenuAction('add-after', i)} />
          </Box>
        ))}
      </Box>
    </Stack>
  );
}

// ─── View Mode ───────────────────────────────────────────────

function ViewContent({ competitor, passings, passingsLoading, eventId, onPassingsChanged, withPassings }: {
  competitor: Competitor;
  passings: Passing[];
  passingsLoading: boolean;
  eventId: string;
  onPassingsChanged: () => void;
  withPassings: boolean;
}) {
  const c = competitor;
  const [editorState, setEditorState] = useState<{
    mode: 'edit' | 'add-before' | 'add-after';
    index: number;
  } | null>(null);
  const card = c.card1 || c.card2;

  const fullName = [c.lastName, c.firstName, c.middleName].filter(Boolean).join(' ');
  const intName = [c.lastNameInt, c.firstNameInt].filter(Boolean).join(' ');
  const genderLabel = c.gender === 'M' ? ' (male)' : c.gender === 'F' ? ' (female)' : '';
  const locationParts = [c.country, c.region, c.city].filter(Boolean);
  const hasStatuses = c.dsq === 1 || c.dns === 1 || c.dnf === 1 || c.outOfRank === 1;

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      divider={<Divider orientation="vertical" flexItem />}
      spacing={3}
      sx={{ minHeight: 200 }}
    >
      {/* ── Left Column ── */}
      <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
        {/* Main info block: two sub-columns on wide screens */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
          {/* Left sub-column: Bib, statuses, name, birth, rank, distance, group, team */}
          <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
            {/* Bib + statuses */}
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              {c.bib && (
                <Typography sx={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1 }}>
                  {c.bib}
                </Typography>
              )}
              {hasStatuses && (
                <Stack spacing={0.25} sx={{ pt: 0.5 }}>
                  {c.dsq === 1 && (
                    c.dsqDescription ? (
                      <Tooltip title={c.dsqDescription} arrow>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'error.main', cursor: 'pointer' }}>DSQ</Typography>
                      </Tooltip>
                    ) : (
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'error.main' }}>DSQ</Typography>
                    )
                  )}
                  {c.dns === 1 && <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'error.main' }}>DNS</Typography>}
                  {c.dnf === 1 && <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'error.main' }}>DNF</Typography>}
                  {c.outOfRank === 1 && <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'error.main' }}>Out of Rank</Typography>}
                </Stack>
              )}
            </Stack>

            {/* Name */}
            <Stack spacing={0}>
              <Typography sx={{ fontSize: '1.4rem', fontWeight: 600 }}>
                {fullName}
              </Typography>
              {(intName || genderLabel) && (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
                  {intName}{genderLabel}
                </Typography>
              )}
            </Stack>

            {/* Birth date + Rank row */}
            {(c.birthDate || c.birthYear || c.rank || c.rating) ? (
              <Stack direction="row" spacing={3}>
                <ViewField label="Birth date" value={c.birthDate || (c.birthYear ? String(c.birthYear) : null)} />
                <ViewField label="Rank" value={c.rank} />
                <ViewField label="Rating" value={c.rating || null} />
              </Stack>
            ) : null}

            {/* Distance */}
            <ViewField label="Distance" value={c.courseId} />

            {/* Group */}
            <ViewField label="Group" value={c.groupId} />

            {/* Team */}
            {(c.teamId || locationParts.length > 0) && (
              <Stack spacing={0}>
                <ViewLabel>Team</ViewLabel>
                {c.teamId && <ViewValue>{c.teamId}</ViewValue>}
                {locationParts.length > 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                    {locationParts.join(', ')}
                  </Typography>
                )}
              </Stack>
            )}
          </Stack>

          {/* Right sub-column: Start time + Adjust */}
          {(c.startTime || c.timeAdjustment) ? (
            <Stack spacing={1} alignItems={{ xs: 'flex-start', sm: 'flex-end' }} sx={{ flexShrink: 0 }}>
              {c.startTime && (
                <Stack alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
                  <ViewLabel>Start time</ViewLabel>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.1 }}>
                    {c.startTime}
                  </Typography>
                </Stack>
              )}
              {c.timeAdjustment ? (
                <Stack alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
                  <ViewLabel>Adjust time:</ViewLabel>
                  <Typography sx={{ fontSize: '1.3rem', fontWeight: 500, lineHeight: 1.1 }}>
                    {c.timeAdjustment}
                  </Typography>
                </Stack>
              ) : null}
            </Stack>
          ) : null}
        </Stack>

        {/* Phone + Email (below the two sub-columns) */}
        {(c.phone || c.email) && (
          <Stack direction="row" spacing={3}>
            <ViewField label="Phone" value={c.phone} />
            <ViewField label="Email" value={c.email} />
          </Stack>
        )}

        {/* Notes */}
        {c.notes && (
          <Stack spacing={0}>
            <ViewLabel>Notes</ViewLabel>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
              {c.notes}
            </Typography>
          </Stack>
        )}
      </Stack>

      {/* ── Right Column ── */}
      <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
        {/* Entry number + Price row */}
        {(c.entryNumber || c.price) ? (
          <Stack direction="row" spacing={3}>
            {c.entryNumber && (
              <Stack spacing={0.5}>
                <ViewLabel>Entry number</ViewLabel>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 500 }}>{c.entryNumber}</Typography>
                  {c.isCheckin === 1 && <Chip label="Checked in" size="small" color="success" variant="outlined" />}
                </Stack>
              </Stack>
            )}
            {c.price ? (
              <Stack spacing={0.5}>
                <ViewLabel>Price</ViewLabel>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 500 }}>{c.price}</Typography>
                  {c.isPaid === 1 && <Chip label="Paid" size="small" color="success" variant="outlined" />}
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        ) : null}

        {/* Checkin/Paid standalone if no entry/price */}
        {!c.entryNumber && !c.price && (c.isCheckin || c.isPaid) ? (
          <Stack direction="row" spacing={1}>
            {c.isCheckin === 1 && <Chip label="Checked in" size="small" color="success" variant="outlined" />}
            {c.isPaid === 1 && <Chip label="Paid" size="small" color="success" variant="outlined" />}
          </Stack>
        ) : null}

        {/* Cards */}
        {(c.card1 || c.card2) && (
          <Stack spacing={0.5}>
            <ViewLabel>Cards</ViewLabel>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {c.card1 && <Chip label={c.card1} size="small" color="success" />}
              {c.card2 && <Chip label={c.card2} size="small" color="success" />}
            </Stack>
          </Stack>
        )}

        {/* Passings */}
        {withPassings && passingsLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {withPassings && !passingsLoading && passings.length > 0 && <PassingsStrip
          passings={passings}
          eventId={eventId}
          onMenuAction={(action, index) => setEditorState({ mode: action, index })}
          onAfterToggle={onPassingsChanged}
        />}
        {withPassings && !passingsLoading && passings.length === 0 && card && (
          <Stack spacing={0.5}>
            <ViewLabel>Passings (0)</ViewLabel>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setEditorState({ mode: 'add-before', index: 0 })}
            >
              Add passing
            </Button>
          </Stack>
        )}
        {withPassings && editorState && card && (
          <PassingsEditor
            open
            onClose={() => setEditorState(null)}
            eventId={eventId}
            card={card}
            passings={passings}
            initialIndex={editorState.index}
            initialMode={editorState.mode}
            onAfterSave={onPassingsChanged}
          />
        )}
      </Stack>
    </Stack>
  );
}

// ─── Edit / Create Form ──────────────────────────────────────

function EditForm({ control, errors, saving }: {
  control: ReturnType<typeof useForm<CompetitorFormData>>['control'];
  errors: ReturnType<typeof useForm<CompetitorFormData>>['formState']['errors'];
  saving: boolean;
}) {
  return (
    <>
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
    </>
  );
}

// ─── Main Dialog ─────────────────────────────────────────────

export function CompetitorDialog({ open, mode, onClose, onSaved, onEditClick, eventId, competitorId, competitor, withPassings = true }: CompetitorDialogProps) {
  const isView = mode === 'view';
  const isEdit = mode === 'edit';
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passings, setPassings] = useState<Passing[]>([]);
  const [passingsLoading, setPassingsLoading] = useState(false);

  // Fresh competitor data fetched from API on open (view mode).
  const [fetchedCompetitor, setFetchedCompetitor] = useState<Competitor | null>(null);
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [competitorError, setCompetitorError] = useState<string | null>(null);

  // Loading state for edit mode (re-fetch before populating the form).
  const [editLoading, setEditLoading] = useState(false);

  // Resolve the ID: explicit competitorId prop, or from competitor object.
  const resolvedId = competitorId ?? competitor?.id ?? null;

  // In view mode, use fetched data. In edit/create, use the prop.
  const viewCompetitor = fetchedCompetitor;

  const { control, handleSubmit, reset, formState: { errors } } = useForm<CompetitorFormData>({
    resolver: joiResolver(schema, { abortEarly: false, stripUnknown: true }),
    defaultValues: DEFAULT_VALUES,
  });

  // Fetch competitor data when opening in view mode.
  useEffect(() => {
    if (!open || !isView || !resolvedId || !eventId) {
      setFetchedCompetitor(null);
      setCompetitorError(null);
      return;
    }
    setCompetitorLoading(true);
    setCompetitorError(null);
    api.get<Competitor>(`/api/events/${eventId}/competitors/${resolvedId}`)
      .then(setFetchedCompetitor)
      .catch((err) => { setFetchedCompetitor(null); setCompetitorError(err instanceof Error ? err.message : 'Failed to load'); })
      .finally(() => setCompetitorLoading(false));
  }, [open, isView, resolvedId, eventId]);

  useEffect(() => {
    if (!open || isView) return;
    setError(null);

    if (resolvedId && eventId) {
      // Always re-fetch from API to get the freshest data.
      setEditLoading(true);
      api.get<Competitor>(`/api/events/${eventId}/competitors/${resolvedId}`)
        .then((data) => {
          reset(competitorToForm(data));
        })
        .catch((err) => {
          // Fallback to prop data if available.
          reset(competitor ? competitorToForm(competitor) : DEFAULT_VALUES);
          setError(err instanceof Error ? err.message : 'Failed to load competitor data');
        })
        .finally(() => setEditLoading(false));
    } else {
      reset(competitor ? competitorToForm(competitor) : DEFAULT_VALUES);
    }
  }, [open, mode, resolvedId, eventId, competitor, reset, isView]);

  const fetchPassings = useCallback(() => {
    if (!eventId || !fetchedCompetitor) return;
    const cards: string[] = [];
    if (fetchedCompetitor.card1) cards.push(fetchedCompetitor.card1);
    if (fetchedCompetitor.card2) cards.push(fetchedCompetitor.card2);
    if (!cards.length) { setPassings([]); return; }
    setPassingsLoading(true);
    const params = new URLSearchParams();
    cards.forEach((card) => params.append('card', card));
    api.get<Passing[]>(`/api/events/${eventId}/passings?${params.toString()}`)
      .then(setPassings)
      .catch(() => setPassings([]))
      .finally(() => setPassingsLoading(false));
  }, [eventId, fetchedCompetitor]);

  useEffect(() => {
    if (!open || !isView || !withPassings || !fetchedCompetitor) { setPassings([]); return; }
    fetchPassings();
  }, [open, isView, withPassings, fetchedCompetitor, fetchPassings]);

  const onSubmit = async (data: CompetitorFormData) => {
    setSaving(true);
    setError(null);
    try {
      const payload = formToPayload(data);
      if (isEdit && resolvedId) {
        await api.put(`/api/events/${eventId}/competitors/${resolvedId}`, payload);
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

  const competitorName = viewCompetitor
    ? [viewCompetitor.lastName, viewCompetitor.firstName].filter(Boolean).join(' ') || 'Competitor'
    : '';

  const title = isView
    ? (competitorName || 'Competitor')
    : isEdit
      ? 'Edit competitor'
      : 'New competitor';

  return (
    <Dialog open={open} onClose={handleClose} maxWidth={isView ? 'md' : 'sm'} fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
        <Typography variant="h6" component="span" noWrap sx={{ flex: 1, minWidth: 0 }}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
          {isView ? (
            onEditClick && (
              <Button size="small" color="inherit" onClick={onEditClick}>
                Edit
              </Button>
            )
          ) : (
            <IconButton size="small" onClick={handleClose} disabled={saving}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </DialogTitle>

      {isView ? (
        competitorLoading ? (
          <DialogContent dividers sx={{ p: 3, borderBottom: 'none', display: 'flex', justifyContent: 'center', minHeight: 200, alignItems: 'center' }}>
            <CircularProgress size={32} />
          </DialogContent>
        ) : competitorError ? (
          <DialogContent dividers sx={{ p: 3, borderBottom: 'none' }}>
            <Alert severity="error">{competitorError}</Alert>
          </DialogContent>
        ) : viewCompetitor ? (
          <DialogContent dividers sx={{ p: 3, borderBottom: 'none' }}>
            <ViewContent competitor={viewCompetitor} passings={passings} passingsLoading={passingsLoading} eventId={eventId} onPassingsChanged={fetchPassings} withPassings={withPassings} />
          </DialogContent>
        ) : null
      ) : editLoading ? (
        <DialogContent dividers sx={{ p: 3, borderBottom: 'none', display: 'flex', justifyContent: 'center', minHeight: 200, alignItems: 'center' }}>
          <CircularProgress size={32} />
        </DialogContent>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogContent dividers sx={{ pt: 1 }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <EditForm control={control} errors={errors} saving={saving} />
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 1.5 }}>
            <Button onClick={handleClose} disabled={saving}>Cancel</Button>
            <Button variant="contained" type="submit" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Save' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
