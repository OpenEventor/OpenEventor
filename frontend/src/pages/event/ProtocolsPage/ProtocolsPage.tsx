import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { PictureAsPdf as PdfIcon } from '@mui/icons-material';
import { api } from '../../../api/client.ts';
import { useEvent } from '../../../contexts/EventContext.tsx';
import type {
  Course,
  Group,
  ProtocolDocument,
  ProtocolGrouping,
  ProtocolType,
} from '../../../api/types.ts';
import { columnLabel, cellText, columnAlign, type FormatContext } from './format.ts';

// ── Control state ────────────────────────────────────────────────
interface Controls {
  type: ProtocolType;
  grouping: ProtocolGrouping;
  showTeam: boolean;
  showCountry: boolean;
  showStart: boolean;
  showRank: boolean;
  showComment: boolean;
  gapLeader: boolean;
  gapPrev: boolean;
  usePoints: boolean;
  printDsq: boolean;
  printDnf: boolean;
  printDns: boolean;
  pageBreak: boolean;
}

type BoolControl = Exclude<keyof Controls, 'type' | 'grouping'>;

// Defaults mirror the backend protocols.ConfigFromSettings (results / by-group,
// team on, points on).
const DEFAULT_CONTROLS: Controls = {
  type: 'results',
  grouping: 'group',
  showTeam: true,
  showCountry: false,
  showStart: false,
  showRank: false,
  showComment: false,
  gapLeader: false,
  gapPrev: false,
  usePoints: true,
  printDsq: false,
  printDnf: false,
  printDns: false,
  pageBreak: false,
};

// Map each boolean control to its query-param key and its persisted setting key.
const BOOL_META: Record<BoolControl, { query: string; setting: string }> = {
  showTeam: { query: 'showTeam', setting: 'protocol_show_team' },
  showCountry: { query: 'showCountry', setting: 'protocol_show_country' },
  showStart: { query: 'showStart', setting: 'protocol_show_start' },
  showRank: { query: 'showRank', setting: 'protocol_show_rank' },
  showComment: { query: 'showComment', setting: 'protocol_show_comment' },
  gapLeader: { query: 'gapLeader', setting: 'protocol_gap_leader' },
  gapPrev: { query: 'gapPrev', setting: 'protocol_gap_prev' },
  usePoints: { query: 'usePoints', setting: 'protocol_use_points' },
  printDsq: { query: 'printDsq', setting: 'protocol_print_dsq' },
  printDnf: { query: 'printDnf', setting: 'protocol_print_dnf' },
  printDns: { query: 'printDns', setting: 'protocol_print_dns' },
  pageBreak: { query: 'pageBreak', setting: 'protocol_page_break' },
};

// Grouped toggles for the control panel. `resultsOnly` toggles are disabled for
// the start protocol (the backend ignores them there). `labelKey` is an i18n key.
const COLUMN_TOGGLES: { key: BoolControl; labelKey: string; resultsOnly?: boolean }[] = [
  { key: 'showTeam', labelKey: 'protocols.toggles.team' },
  { key: 'showCountry', labelKey: 'protocols.toggles.country' },
  { key: 'showRank', labelKey: 'protocols.toggles.rank' },
  { key: 'showStart', labelKey: 'protocols.toggles.startTime', resultsOnly: true },
  { key: 'showComment', labelKey: 'protocols.toggles.comment' },
];
const RESULT_TOGGLES: { key: BoolControl; labelKey: string }[] = [
  { key: 'gapLeader', labelKey: 'protocols.toggles.gapLeader' },
  { key: 'gapPrev', labelKey: 'protocols.toggles.gapPrev' },
  { key: 'usePoints', labelKey: 'protocols.toggles.points' },
];
const NONFINISHER_TOGGLES: { key: BoolControl; labelKey: string }[] = [
  { key: 'printDsq', labelKey: 'protocols.toggles.showDsq' },
  { key: 'printDnf', labelKey: 'protocols.toggles.showDnf' },
  { key: 'printDns', labelKey: 'protocols.toggles.showDns' },
];

function controlsFromSettings(s: Record<string, string>): Controls {
  const b = (key: string, dflt: boolean) => (s[key] === undefined ? dflt : s[key] === '1');
  return {
    type: s.protocol_type === 'start' ? 'start' : 'results',
    grouping: s.protocol_grouping === 'course' ? 'course' : 'group',
    showTeam: b('protocol_show_team', true),
    showCountry: b('protocol_show_country', false),
    showStart: b('protocol_show_start', false),
    showRank: b('protocol_show_rank', false),
    showComment: b('protocol_show_comment', false),
    gapLeader: b('protocol_gap_leader', false),
    gapPrev: b('protocol_gap_prev', false),
    usePoints: b('protocol_use_points', true),
    printDsq: b('protocol_print_dsq', false),
    printDnf: b('protocol_print_dnf', false),
    printDns: b('protocol_print_dns', false),
    pageBreak: b('protocol_page_break', false),
  };
}

function settingsFromControls(c: Controls): Record<string, string> {
  const out: Record<string, string> = {
    protocol_type: c.type,
    protocol_grouping: c.grouping,
  };
  (Object.keys(BOOL_META) as BoolControl[]).forEach((k) => {
    out[BOOL_META[k].setting] = c[k] ? '1' : '0';
  });
  return out;
}

function buildQuery(c: Controls, ids: string[]): string {
  const p = new URLSearchParams();
  p.set('type', c.type);
  p.set('by', c.grouping);
  (Object.keys(BOOL_META) as BoolControl[]).forEach((k) => {
    p.set(BOOL_META[k].query, c[k] ? '1' : '0');
  });
  if (ids.length) p.set('ids', ids.join(','));
  return p.toString();
}

function sanitizeFileName(name: string): string {
  const cleaned = name.trim().replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'protocol';
}

interface SectionOption {
  id: string;
  name: string;
}

export function ProtocolsPage() {
  const { t } = useTranslation();
  const { eventId } = useParams<{ eventId: string }>();
  const { settings, loading: eventLoading, displayName, date, timezone } = useEvent();

  const [controls, setControls] = useState<Controls>(DEFAULT_CONTROLS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [doc, setDoc] = useState<ProtocolDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fmtCtx: FormatContext = useMemo(() => ({ baseDate: date, timezone }), [date, timezone]);

  // Initialize control state from the event's saved protocol_* settings (once).
  const initedRef = useRef(false);
  const skipSaveRef = useRef(true);
  useEffect(() => {
    if (initedRef.current || eventLoading) return;
    setControls(controlsFromSettings(settings));
    initedRef.current = true;
  }, [eventLoading, settings]);

  // Persist control changes back to protocol_* settings (debounced, best-effort).
  useEffect(() => {
    if (!initedRef.current || !eventId) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      api
        .put(`/api/events/${eventId}/settings`, { settings: settingsFromControls(controls) })
        .catch(() => { /* best-effort */ });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [controls, eventId]);

  // Section names for the multiselect.
  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      api.get<Group[]>(`/api/events/${eventId}/groups`),
      api.get<Course[]>(`/api/events/${eventId}/courses`),
    ])
      .then(([g, c]) => { setGroups(g); setCourses(c); })
      .catch(() => { /* section picker is optional */ });
  }, [eventId]);

  // Fetch the protocol document whenever the query changes; ignore stale responses.
  const query = useMemo(() => buildQuery(controls, selectedIds), [controls, selectedIds]);
  const reqIdRef = useRef(0);
  useEffect(() => {
    if (!eventId) return;
    const id = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    api
      .get<ProtocolDocument>(`/api/events/${eventId}/protocols?${query}`)
      .then((data) => { if (id === reqIdRef.current) setDoc(data); })
      .catch((err) => {
        if (id === reqIdRef.current) {
          setError(err instanceof Error ? err.message : t('protocols.loadError'));
        }
      })
      .finally(() => { if (id === reqIdRef.current) setLoading(false); });
  }, [eventId, query, t]);

  const setBool = useCallback((key: BoolControl, value: boolean) => {
    setControls((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleType = (_: unknown, value: ProtocolType | null) => {
    if (value) setControls((prev) => ({ ...prev, type: value }));
  };
  const handleGrouping = (_: unknown, value: ProtocolGrouping | null) => {
    if (value) {
      setControls((prev) => ({ ...prev, grouping: value }));
      setSelectedIds([]); // section ids differ between groups and courses
    }
  };

  const sectionOptions: SectionOption[] = useMemo(() => {
    const src = controls.grouping === 'group' ? groups : courses;
    return src.map((x) => ({ id: x.id, name: x.name }));
  }, [controls.grouping, groups, courses]);

  const selectedOptions = useMemo(
    () => sectionOptions.filter((o) => selectedIds.includes(o.id)),
    [sectionOptions, selectedIds],
  );

  const docTitle = controls.type === 'results'
    ? t('protocols.resultsProtocol')
    : t('protocols.startProtocol');

  const handleDownload = async () => {
    if (!doc) return;
    const fileName = `${sanitizeFileName(displayName || 'protocol')}_${controls.type}.pdf`;
    // Lazy-load pdfmake (+ its ~1 MB font vfs) only when the user downloads.
    const { downloadProtocolPdf } = await import('./protocolPdf.ts');
    downloadProtocolPdf(
      doc,
      { title: docTitle, eventName: displayName, eventDate: date },
      fmtCtx,
      fileName,
    );
  };

  const hasSections = !!doc && doc.sections.length > 0;
  const isStart = controls.type === 'start';

  const renderToggle = (key: BoolControl, label: string, disabled = false) => (
    <FormControlLabel
      key={key}
      control={
        <Switch
          size="small"
          checked={controls[key]}
          disabled={disabled}
          onChange={(e) => setBool(key, e.target.checked)}
        />
      }
      label={label}
      slotProps={{ typography: { variant: 'body2' } }}
    />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar: title + download */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6">{t('protocols.title')}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          size="small"
          startIcon={<PdfIcon />}
          sx={{ height: 40 }}
          disabled={!hasSections}
          onClick={handleDownload}
        >
          {t('protocols.downloadPdf')}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
        {/* Control panel */}
        <Paper
          variant="outlined"
          sx={{
            width: 270,
            flexShrink: 0,
            p: 2,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="overline" color="text.secondary">{t('protocols.type')}</Typography>
            <ToggleButtonGroup size="small" exclusive fullWidth value={controls.type} onChange={handleType}>
              <ToggleButton value="start">{t('protocols.typeStart')}</ToggleButton>
              <ToggleButton value="results">{t('protocols.typeResults')}</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box>
            <Typography variant="overline" color="text.secondary">{t('protocols.grouping')}</Typography>
            <ToggleButtonGroup size="small" exclusive fullWidth value={controls.grouping} onChange={handleGrouping}>
              <ToggleButton value="group">{t('protocols.byGroup')}</ToggleButton>
              <ToggleButton value="course">{t('protocols.byCourse')}</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {t('protocols.sections')}
            </Typography>
            <Autocomplete
              multiple
              size="small"
              options={sectionOptions}
              value={selectedOptions}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, value) => setSelectedIds(value.map((o) => o.id))}
              renderInput={(params) => (
                <TextField {...params} placeholder={selectedIds.length ? '' : t('protocols.allSections')} />
              )}
              limitTags={3}
            />
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="overline" color="text.secondary">{t('protocols.columnsHeading')}</Typography>
            {COLUMN_TOGGLES.map((tog) => renderToggle(tog.key, t(tog.labelKey), tog.resultsOnly && isStart))}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="overline" color="text.secondary">{t('protocols.resultsHeading')}</Typography>
            {RESULT_TOGGLES.map((tog) => renderToggle(tog.key, t(tog.labelKey), isStart))}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="overline" color="text.secondary">{t('protocols.nonFinishers')}</Typography>
            {NONFINISHER_TOGGLES.map((tog) => renderToggle(tog.key, t(tog.labelKey), isStart))}
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="overline" color="text.secondary">{t('protocols.pdfLayout')}</Typography>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={controls.pageBreak}
                  onChange={(e) => setBool('pageBreak', e.target.checked)}
                />
              }
              label={t('protocols.pageBreakPerSection')}
              slotProps={{ typography: { variant: 'body2' } }}
            />
          </Box>
        </Paper>

        {/* Preview */}
        <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          {loading && !doc ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} />
            </Box>
          ) : !hasSections ? (
            <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
              <Typography>{t('protocols.noMatch')}</Typography>
            </Box>
          ) : (
            <Box sx={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s', maxWidth: 900 }}>
              {/* Document header */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>{docTitle}</Typography>
                <Typography variant="subtitle1" color="text.secondary">
                  {[displayName, date].filter(Boolean).join('  •  ')}
                </Typography>
              </Box>

              {doc!.sections.map((section) => (
                <Box key={section.id} sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 0.5 }}>{section.title}</Typography>
                  {section.subtitle && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {section.subtitle}
                    </Typography>
                  )}
                  <Box sx={{ overflowX: 'auto' }}>
                    <Table size="small" sx={{ '& td, & th': { py: 0.4 } }}>
                      <TableHead>
                        <TableRow>
                          {doc!.columns.map((k) => (
                            <TableCell key={k} align={columnAlign(k)} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {columnLabel(k, t)}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {section.rows.map((row) => {
                          const muted = doc!.type === 'results' && !row.isFinisher;
                          return (
                            <TableRow key={row.competitorId}>
                              {doc!.columns.map((k) => (
                                <TableCell
                                  key={k}
                                  align={columnAlign(k)}
                                  sx={{
                                    color: muted ? 'text.secondary' : 'inherit',
                                    whiteSpace: columnAlign(k) === 'right' ? 'nowrap' : 'normal',
                                    fontVariantNumeric: columnAlign(k) === 'right' ? 'tabular-nums' : undefined,
                                  }}
                                >
                                  {cellText(row, k, fmtCtx)}
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
