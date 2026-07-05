import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  PhotoCamera as PhotoCameraIcon,
  Upload as UploadIcon,
  DeleteOutlined as DeleteIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { type Dayjs } from 'dayjs';
import Field from '../../../components/Field/Field.tsx';
import LogoCropDialog from './LogoCropDialog.tsx';
import { api, getStoredToken } from '../../../api/client.ts';
import type { EventFile } from '../../../api/types.ts';
import { useEvent } from '../../../contexts/EventContext.tsx';

const TIMEZONES = Intl.supportedValuesOf('timeZone');

function getGmtOffset(tz: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
    const parts = fmt.formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

const TZ_LABELS = new Map(TIMEZONES.map((tz) => [tz, `${tz} (${getGmtOffset(tz)})`]));

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography
      variant="subtitle2"
      sx={{ mt: 3, mb: 1, fontWeight: 600, color: 'text.secondary', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}
    >
      {children}
    </Typography>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { eventId, settings, loading, refresh } = useEvent();

  // Text fields
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [date, setDate] = useState<Dayjs | null>(null);
  const [timezone, setTimezone] = useState('UTC');
  const [director, setDirector] = useState('');
  const [chiefJudge, setChiefJudge] = useState('');
  const [chiefSecretary, setChiefSecretary] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Logo
  const [logoFileId, setLogoFileId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null); // object URL of the image being cropped
  const fileInputRef = useRef<HTMLInputElement>(null);

  // (Re)initialise the form whenever the settings map changes (initial load + post-save refresh).
  useEffect(() => {
    setName(settings.display_name ?? '');
    setPlace(settings.place ?? '');
    setDate(settings.date ? dayjs(settings.date) : null);
    setTimezone(settings.timezone || 'UTC');
    setDirector(settings.director ?? '');
    setChiefJudge(settings.chief_judge ?? '');
    setChiefSecretary(settings.chief_secretary ?? '');
  }, [settings]);

  // Revoke the previous object URL when it changes or on unmount.
  useEffect(() => {
    return () => {
      if (logoUrl) URL.revokeObjectURL(logoUrl);
    };
  }, [logoUrl]);

  // Same for the transient crop-source URL (revoked on Save/Cancel — when it flips
  // back to null — and on unmount).
  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  const loadLogo = useCallback(async () => {
    if (!eventId) return;
    try {
      const files = await api.get<EventFile[]>(`/api/events/${eventId}/files?purpose=logo`);
      const first = files[0];
      if (!first) {
        setLogoFileId(null);
        setLogoUrl(null);
        return;
      }
      setLogoFileId(first.id);
      const token = getStoredToken();
      const resp = await fetch(`/api/events/${eventId}/files/${first.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!resp.ok) throw new Error(t('settings.logoError'));
      const blob = await resp.blob();
      setLogoUrl(URL.createObjectURL(blob));
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : t('settings.logoError'));
    }
  }, [eventId, t]);

  useEffect(() => {
    void loadLogo();
  }, [loadLogo]);

  const handlePickLogo = () => fileInputRef.current?.click();

  // Picking a file opens the interactive crop modal instead of uploading straight away.
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file (also resets on Cancel)
    if (!file || !eventId) return;
    setLogoError(null);
    setCropSrc(URL.createObjectURL(file));
  };

  const handleCropCancel = () => setCropSrc(null); // effect cleanup revokes the URL

  // Save from the crop modal: upload the cropped PNG through the existing /files path.
  const handleCropped = async (blob: Blob) => {
    if (!eventId) return;
    setLogoBusy(true);
    setLogoError(null);
    try {
      const form = new FormData();
      form.append('file', blob, 'logo.png');
      form.append('purpose', 'logo');
      await api.upload(`/api/events/${eventId}/files`, form);
      await loadLogo();
      setCropSrc(null); // effect cleanup revokes the URL
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : t('settings.logoError'));
    } finally {
      setLogoBusy(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!eventId || !logoFileId) return;
    setLogoBusy(true);
    setLogoError(null);
    try {
      await api.del(`/api/events/${eventId}/files/${logoFileId}`);
      setLogoFileId(null);
      setLogoUrl(null);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : t('settings.logoError'));
    } finally {
      setLogoBusy(false);
    }
  };

  const handleSave = async () => {
    if (!eventId) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Empty strings clear the key server-side.
      await api.put(`/api/events/${eventId}/settings`, {
        settings: {
          display_name: name.trim(),
          place: place.trim(),
          date: date?.isValid() ? date.format('YYYY-MM-DD') : '',
          timezone: timezone || '',
          director: director.trim(),
          chief_judge: chiefJudge.trim(),
          chief_secretary: chiefSecretary.trim(),
        },
      });
      await refresh();
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  // Ensure the stored timezone always renders even if not in the platform list.
  const tzOptions = timezone && !TIMEZONES.includes(timezone) ? [timezone, ...TIMEZONES] : TIMEZONES;

  const entries = Object.entries(settings);

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {t('settings.title')}
      </Typography>

      {loading ? (
        <Typography sx={{ color: 'text.secondary' }}>{t('common.loading')}</Typography>
      ) : (
        <>
          {/* Logo */}
          <SectionTitle>{t('settings.logo')}</SectionTitle>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2} sx={{ alignItems: 'center' }}>
              <Avatar
                variant="rounded"
                src={logoUrl ?? undefined}
                sx={{ width: 120, height: 120, bgcolor: 'action.hover', color: 'text.disabled' }}
              >
                {!logoUrl && <PhotoCameraIcon fontSize="large" />}
              </Avatar>
              {logoError && <Alert severity="error" sx={{ width: '100%' }}>{logoError}</Alert>}
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={logoBusy ? <CircularProgress size={16} /> : <UploadIcon />}
                  onClick={handlePickLogo}
                  disabled={logoBusy}
                >
                  {t('settings.uploadLogo')}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleRemoveLogo}
                  disabled={logoBusy || !logoFileId}
                >
                  {t('settings.removeLogo')}
                </Button>
              </Stack>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleFileSelected}
              />
            </Stack>
          </Paper>

          <LogoCropDialog
            imageSrc={cropSrc}
            busy={logoBusy}
            onCancel={handleCropCancel}
            onCropped={handleCropped}
          />

          {/* Event */}
          <SectionTitle>{t('settings.event')}</SectionTitle>
          <Stack spacing={2}>
            <Field label={t('common.name')}>
              <TextField
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                size="small"
                disabled={saving}
              />
            </Field>
            <Field label={t('settings.place')}>
              <TextField
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                fullWidth
                size="small"
                disabled={saving}
              />
            </Field>
            <Field label={t('common.date')}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  value={date}
                  onChange={(value) => setDate(value)}
                  disabled={saving}
                  format="DD.MM.YYYY"
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </LocalizationProvider>
            </Field>
            <Field label={t('events.timezone')}>
              <Autocomplete
                value={timezone}
                onChange={(_, value) => setTimezone(value ?? 'UTC')}
                options={tzOptions}
                getOptionLabel={(tz) => TZ_LABELS.get(tz) ?? tz}
                disableClearable
                disabled={saving}
                size="small"
                fullWidth
                renderInput={(params) => <TextField {...params} placeholder={t('events.timezone')} />}
              />
            </Field>
          </Stack>

          {/* Officials */}
          <SectionTitle>{t('settings.officials')}</SectionTitle>
          <Stack spacing={2}>
            <Field label={t('settings.director')}>
              <TextField
                value={director}
                onChange={(e) => setDirector(e.target.value)}
                fullWidth
                size="small"
                disabled={saving}
              />
            </Field>
            <Field label={t('settings.chiefJudge')}>
              <TextField
                value={chiefJudge}
                onChange={(e) => setChiefJudge(e.target.value)}
                fullWidth
                size="small"
                disabled={saving}
              />
            </Field>
            <Field label={t('settings.chiefSecretary')}>
              <TextField
                value={chiefSecretary}
                onChange={(e) => setChiefSecretary(e.target.value)}
                fullWidth
                size="small"
                disabled={saving}
              />
            </Field>
          </Stack>

          {saveError && <Alert severity="error" sx={{ mt: 2 }}>{saveError}</Alert>}

          <Box sx={{ mt: 3 }}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </Box>

          {/* Advanced: raw key/value viewer (read-only) */}
          <Accordion variant="outlined" disableGutters sx={{ mt: 4 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                {t('settings.advanced')}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              {entries.length === 0 ? (
                <Typography sx={{ color: 'text.secondary', p: 2 }}>{t('settings.empty')}</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>{t('settings.key')}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{t('settings.value')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {entries.map(([key, value]) => (
                        <TableRow key={key}>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{key}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </AccordionDetails>
          </Accordion>
        </>
      )}

      <Snackbar
        open={saved}
        autoHideDuration={3000}
        onClose={() => setSaved(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSaved(false)}>
          {t('settings.saved')}
        </Alert>
      </Snackbar>
    </Box>
  );
}
