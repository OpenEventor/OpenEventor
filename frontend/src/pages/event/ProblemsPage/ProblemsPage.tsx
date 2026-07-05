import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import {
  Error as CriticalIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircleOutlined as OkIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { api } from '../../../api/client.ts';
import type {
  Problem,
  ProblemSeverity,
  ProblemSubjectType,
  ProblemsResponse,
} from '../../../api/types.ts';

// Human-readable title for a problem, from a localized template keyed by `kind`.
// Placeholders like {{courseName}} are substituted from `params`; the special
// `{{competitor}}` falls back to a localized "Unnamed competitor".
function problemTitle(
  t: TFunction,
  kind: string,
  params?: Record<string, string>,
): string {
  const p = params ?? {};
  const competitor =
    p.competitor && p.competitor.trim()
      ? p.competitor
      : t('problems.unnamedCompetitor');
  return t(`problems.kinds.${kind}`, { ...p, competitor, defaultValue: kind });
}

const SEVERITY_META: Record<
  ProblemSeverity,
  { icon: SvgIconComponent; color: string; label: string }
> = {
  critical: { icon: CriticalIcon, color: 'error.main', label: 'Critical' },
  warning: { icon: WarningIcon, color: 'warning.main', label: 'Warning' },
  info: { icon: InfoIcon, color: 'text.secondary', label: 'Info' },
};

// Best-effort navigation to the relevant editor for a problem's subject.
const SUBJECT_ROUTE: Record<ProblemSubjectType, string> = {
  competitor: '../competitors',
  course: '../distances',
  group: '../groups',
  event: '../settings',
  card: '../monitor',
};

type Filter = 'all' | ProblemSeverity;

export function ProblemsPage() {
  const { t } = useTranslation();
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const fetchData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ProblemsResponse>(`/api/events/${eventId}/problems`);
      setProblems(data.problems ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('problems.loadError'));
    } finally {
      setLoading(false);
    }
  }, [eventId, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const counts = useMemo(() => {
    const c = { all: problems.length, critical: 0, warning: 0, info: 0 };
    for (const p of problems) c[p.severity] += 1;
    return c;
  }, [problems]);

  const filtered = useMemo(
    () => (filter === 'all' ? problems : problems.filter((p) => p.severity === filter)),
    [problems, filter],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, flexWrap: 'wrap' }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={filter}
          onChange={(_, val: Filter | null) => { if (val) setFilter(val); }}
        >
          <ToggleButton value="all">{t('common.all')} ({counts.all})</ToggleButton>
          <ToggleButton value="critical">{t('problems.severity.critical')} ({counts.critical})</ToggleButton>
          <ToggleButton value="warning">{t('problems.severity.warning')} ({counts.warning})</ToggleButton>
          <ToggleButton value="info">{t('problems.severity.info')} ({counts.info})</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 1 }} action={<Button onClick={fetchData}>{t('common.retry')}</Button>}>
          {error}
        </Alert>
      )}

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              py: 8,
              color: 'text.secondary',
            }}
          >
            <OkIcon sx={{ fontSize: 48, color: 'success.main' }} />
            <Typography variant="body1">
              {filter === 'all'
                ? t('problems.noneFound')
                : t('problems.noneOfSeverity', { severity: t(`problems.severity.${filter}`) })}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {filtered.map((p) => {
              const meta = SEVERITY_META[p.severity];
              const Icon = meta.icon;
              return (
                <ListItemButton
                  key={p.id}
                  onClick={() => navigate(SUBJECT_ROUTE[p.subject.type])}
                  sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: meta.color }}>
                    <Icon />
                  </ListItemIcon>
                  <ListItemText
                    primary={problemTitle(t, p.kind, p.params)}
                    slotProps={{ primary: { sx: { fontWeight: 500 } } }}
                  />
                  <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Box>
    </Box>
  );
}
