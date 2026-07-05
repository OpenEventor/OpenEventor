import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { joiResolver } from "@hookform/resolvers/joi";
import Joi from "joi";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  Tooltip,
} from "@mui/material";
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";
import { api } from "../../../api/client.ts";
import type {
  Competitor,
  Passing,
  Course,
  Group,
  Team,
  Problem,
  ProblemSeverity,
  ProblemsResponse,
} from "../../../api/types.ts";
import { problemTitle } from "../ProblemsPage/problemTitle.ts";
import {
  computeDeltas,
} from "../../../components/PassingBlock/PassingBlock.tsx";
import Time from "../../../components/Time/Time.tsx";
import { useEvent } from "../../../contexts/EventContext.tsx";
import {
  resolveStartTime,
  resolveStartTimeWithSource,
  type StartSource,
} from "../../../utils/resolveStartTime.ts";
import InteractivePassingBlock from "../../../components/PassingBlock/InteractivePassingBlock.tsx";
import GapIndicator from "../../../components/GapIndicator/GapIndicator.tsx";
import PassingsEditor from "../../../components/PassingsEditor/PassingsEditor.tsx";
import TimeInput from "../../../components/Time/TimeInput.tsx";
import CountryPicker from "../../../components/CountryPicker/CountryPicker.tsx";
import Field from "../../../components/Field/Field.tsx";
import { formatDuration } from "../ProtocolsPage/format.ts";
import countries from "../../../components/CountryPicker/countries.json";

// ─── Computed-results API shapes (GET /results, event-token auth) ────

interface ResultSplitDTO {
  checkpoint: string;
  time: number; // ms from resolved start
  leg: number; // ms since previous split
}

interface ResultRowDTO {
  competitorId: string;
  groupId: string;
  status: string; // OK | DSQ | DNF | DNS | NC
  totalTime: number; // ms
  place: number; // 0 = unranked
  startTime: number; // unix seconds
  startSource: string;
  splits: ResultSplitDTO[];
}

// ─── Country resolution (flag + code) ────────────────────────────────

interface CountryInfo {
  name: string;
  alpha2: string;
  alpha3: string;
}

const COUNTRY_INDEX = new Map<string, CountryInfo>();
(countries as CountryInfo[]).forEach((c) => {
  COUNTRY_INDEX.set(c.alpha2.toUpperCase(), c);
  COUNTRY_INDEX.set(c.alpha3.toUpperCase(), c);
  COUNTRY_INDEX.set(c.name.toLowerCase(), c);
});

function resolveCountry(value: string): CountryInfo | null {
  if (!value) return null;
  return (
    COUNTRY_INDEX.get(value.toUpperCase()) ??
    COUNTRY_INDEX.get(value.toLowerCase()) ??
    null
  );
}

function CountryValue({ value }: { value: string }) {
  const info = resolveCountry(value);
  if (!info) return <ViewValue>{value}</ViewValue>;
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
      <img
        loading="lazy"
        width={20}
        src={`https://flagcdn.com/w40/${info.alpha2.toLowerCase()}.png`}
        srcSet={`https://flagcdn.com/w80/${info.alpha2.toLowerCase()}.png 2x`}
        alt=""
        style={{ borderRadius: 2, objectFit: "cover", flexShrink: 0 }}
      />
      <ViewValue>{info.alpha3}</ViewValue>
    </Stack>
  );
}

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
  birthYear: string;
  rank: string;
  rating: number | "";
  country: string;
  region: string;
  city: string;
  phone: string;
  email: string;
  startTime: number;
  timeAdjustment: number | "";
  dsq: number;
  dsqDescription: string;
  dns: number;
  dnf: number;
  outOfRank: number;
  entryNumber: string;
  price: number | "";
  isPaid: number;
  isCheckin: number;
  notes: string;
}

type TFn = (key: string, options?: Record<string, unknown>) => string;

function buildSchema(t: TFn) {
  return Joi.object<CompetitorFormData>({
    lastName: Joi.string()
      .required()
      .messages({ "string.empty": t("competitors.validation.lastNameRequired") }),
    firstName: Joi.string().allow("").optional(),
    middleName: Joi.string().allow("").optional(),
    firstNameInt: Joi.string().allow("").optional(),
    lastNameInt: Joi.string().allow("").optional(),
    bib: Joi.string().allow("").optional(),
    card1: Joi.string().allow("").optional(),
    card2: Joi.string().allow("").optional(),
    teamId: Joi.string().allow("").optional(),
    groupId: Joi.string().allow("").optional(),
    courseId: Joi.string().allow("").optional(),
    gender: Joi.string().allow("", "M", "F").optional(),
    birthDate: Joi.string()
      .allow("")
      .pattern(/^(\d{2}\.\d{2})?$/)
      .optional()
      .messages({
        "string.pattern.base": t("competitors.validation.birthDateFormat"),
      }),
    birthYear: Joi.string()
      .allow("")
      .pattern(/^(\d{4})?$/)
      .optional()
      .messages({
        "string.pattern.base": t("competitors.validation.birthYearFormat"),
      }),
    rank: Joi.string().allow("").optional(),
    rating: Joi.alternatives()
      .try(Joi.number().min(0), Joi.string().valid(""))
      .optional(),
    country: Joi.string().allow("").optional(),
    region: Joi.string().allow("").optional(),
    city: Joi.string().allow("").optional(),
    phone: Joi.string().allow("").optional(),
    email: Joi.string().allow("").email({ tlds: false }).optional().messages({
      "string.email": t("competitors.validation.emailInvalid"),
    }),
    startTime: Joi.number().min(0).optional(),
    timeAdjustment: Joi.alternatives()
      .try(Joi.number().integer(), Joi.string().valid(""))
      .optional(),
    dsq: Joi.number().valid(0, 1).optional(),
    dsqDescription: Joi.string().allow("").optional(),
    dns: Joi.number().valid(0, 1).optional(),
    dnf: Joi.number().valid(0, 1).optional(),
    outOfRank: Joi.number().valid(0, 1).optional(),
    entryNumber: Joi.string().allow("").optional(),
    price: Joi.alternatives()
      .try(Joi.number().min(0), Joi.string().valid(""))
      .optional(),
    isPaid: Joi.number().valid(0, 1).optional(),
    isCheckin: Joi.number().valid(0, 1).optional(),
    notes: Joi.string().allow("").optional(),
  });
}

const DEFAULT_VALUES: CompetitorFormData = {
  bib: "",
  card1: "",
  card2: "",
  teamId: "",
  groupId: "",
  courseId: "",
  firstName: "",
  lastName: "",
  middleName: "",
  firstNameInt: "",
  lastNameInt: "",
  gender: "",
  birthDate: "",
  birthYear: "",
  rank: "",
  rating: "",
  country: "",
  region: "",
  city: "",
  phone: "",
  email: "",
  startTime: 0,
  timeAdjustment: "",
  dsq: 0,
  dsqDescription: "",
  dns: 0,
  dnf: 0,
  outOfRank: 0,
  entryNumber: "",
  price: "",
  isPaid: 0,
  isCheckin: 0,
  notes: "",
};

export interface CompetitorDialogProps {
  open: boolean;
  mode: "view" | "edit" | "create";
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
    bib: c.bib,
    card1: c.card1,
    card2: c.card2,
    teamId: c.teamId,
    groupId: c.groupId,
    courseId: c.courseId,
    firstName: c.firstName,
    lastName: c.lastName,
    middleName: c.middleName,
    firstNameInt: c.firstNameInt,
    lastNameInt: c.lastNameInt,
    gender: c.gender,
    birthDate: c.birthDate,
    birthYear: c.birthYear ? String(c.birthYear) : "",
    rating: c.rating || "",
    rank: c.rank,
    country: c.country,
    region: c.region,
    city: c.city,
    phone: c.phone,
    email: c.email,
    startTime: c.startTime,
    timeAdjustment: c.timeAdjustment || "",
    dsq: c.dsq,
    dsqDescription: c.dsqDescription,
    dns: c.dns,
    dnf: c.dnf,
    outOfRank: c.outOfRank,
    entryNumber: c.entryNumber,
    price: c.price || "",
    isPaid: c.isPaid,
    isCheckin: c.isCheckin,
    notes: c.notes,
  };
}

// Full PUT payload built straight from a Competitor (no form). Used by the view's
// status quick-toggles so writing one flag never drops the other columns.
function competitorToPayload(c: Competitor) {
  return {
    bib: c.bib,
    card1: c.card1,
    card2: c.card2,
    teamId: c.teamId,
    groupId: c.groupId,
    courseId: c.courseId,
    firstName: c.firstName,
    lastName: c.lastName,
    middleName: c.middleName,
    firstNameInt: c.firstNameInt,
    lastNameInt: c.lastNameInt,
    gender: c.gender,
    birthDate: c.birthDate,
    birthYear: c.birthYear,
    rank: c.rank,
    rating: c.rating,
    country: c.country,
    region: c.region,
    city: c.city,
    phone: c.phone,
    email: c.email,
    startTime: c.startTime,
    timeAdjustment: c.timeAdjustment,
    dsq: c.dsq,
    dsqDescription: c.dsqDescription,
    dns: c.dns,
    dnf: c.dnf,
    outOfRank: c.outOfRank,
    entryNumber: c.entryNumber,
    price: c.price,
    isPaid: c.isPaid,
    isCheckin: c.isCheckin,
    notes: c.notes,
  };
}

function formToPayload(data: CompetitorFormData) {
  return {
    bib: data.bib,
    card1: data.card1,
    card2: data.card2,
    teamId: data.teamId,
    groupId: data.groupId,
    courseId: data.courseId,
    firstName: data.firstName,
    lastName: data.lastName,
    middleName: data.middleName,
    firstNameInt: data.firstNameInt,
    lastNameInt: data.lastNameInt,
    gender: data.gender,
    birthDate: data.birthDate,
    birthYear: data.birthYear === "" ? 0 : Number(data.birthYear),
    rank: data.rank,
    rating: data.rating === "" ? 0 : Number(data.rating),
    country: data.country,
    region: data.region,
    city: data.city,
    phone: data.phone,
    email: data.email,
    startTime: data.startTime,
    timeAdjustment:
      data.timeAdjustment === "" ? 0 : Number(data.timeAdjustment),
    dsq: data.dsq,
    dsqDescription: data.dsqDescription,
    dns: data.dns,
    dnf: data.dnf,
    outOfRank: data.outOfRank,
    entryNumber: data.entryNumber,
    price: data.price === "" ? 0 : Number(data.price),
    isPaid: data.isPaid,
    isCheckin: data.isCheckin,
    notes: data.notes,
  };
}

function SectionTitle({ children, sx }: { children: string; sx?: object }) {
  return (
    <Typography
      variant="subtitle2"
      sx={{
        fontWeight: 600,
        color: "text.secondary",
        fontSize: "0.75rem",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
}

function CollapsibleSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Stack spacing={1}>
      <Box
        onClick={() => setOpen(!open)}
        sx={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          userSelect: "none",
          gap: 0.5,
          "&:hover": { opacity: 0.8 },
        }}
      >
        <SectionTitle>{title}</SectionTitle>
        <ExpandMoreIcon
          sx={{
            fontSize: 16,
            color: "text.secondary",
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </Box>
      <Collapse in={open}>{children}</Collapse>
    </Stack>
  );
}

// ─── View Mode Helpers ───────────────────────────────────────

function ViewLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary" }}
    >
      {children}
    </Typography>
  );
}

function ViewValue({
  children,
  size = "normal",
}: {
  children: React.ReactNode;
  size?: "normal" | "large";
}) {
  return (
    <Typography
      sx={{
        fontSize: size === "large" ? "1.1rem" : "0.95rem",
        wordBreak: "break-word",
      }}
    >
      {children}
    </Typography>
  );
}

// A label-left / value-right data row (mirrors iOS LabeledContent).
function DataRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{
        justifyContent: "space-between",
        alignItems: "baseline",
        py: 0.75,
        mx: -1.5,
        px: 1.5,
        borderBottom: 1,
        borderColor: "divider",
        "&:last-child": { borderBottom: 0 },
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Typography
        variant="body2"
        sx={{ color: "text.secondary", flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Box sx={{ textAlign: "right", minWidth: 0, wordBreak: "break-word" }}>
        {children}
      </Box>
    </Stack>
  );
}

// ─── Effective-status resolution ─────────────────────────────
// The status shown by the badge reflects the COMPUTED result (which already
// folds in the manual DSQ/DNF/DNS flags by priority) when a result exists, else
// the manual flags alone. An OK-but-out-of-rank competitor is surfaced as NC.

const STATUS_META: Record<string, { labelKey: string; color: string }> = {
  OK: { labelKey: "competitors.view.effStatus.ok", color: "success.main" },
  DSQ: { labelKey: "competitors.view.effStatus.dsq", color: "error.main" },
  DNF: { labelKey: "competitors.view.effStatus.dnf", color: "warning.main" },
  DNS: { labelKey: "competitors.view.effStatus.dns", color: "warning.main" },
  NC: { labelKey: "competitors.view.effStatus.nc", color: "text.secondary" },
};

function effectiveStatusCode(
  c: Competitor,
  result: ResultRowDTO | null,
): string {
  let base = "";
  if (result) base = result.status;
  else if (c.dsq === 1) base = "DSQ";
  else if (c.dnf === 1) base = "DNF";
  else if (c.dns === 1) base = "DNS";
  if (base === "OK" && c.outOfRank === 1) base = "NC";
  return base;
}

// A colored pill for the effective status. Optionally wrapped in a tooltip
// (used to surface a DSQ description).
function StatusBadge({ code, tooltip }: { code: string; tooltip?: string }) {
  const { t } = useTranslation();
  const meta = STATUS_META[code];
  if (!meta) return null;
  const pill = (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 1,
        py: 0.25,
        borderRadius: 1,
        bgcolor: meta.color,
        color: "common.white",
        fontSize: "0.85rem",
        fontWeight: 700,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {t(meta.labelKey)}
    </Box>
  );
  return tooltip ? (
    <Tooltip title={tooltip} arrow>
      {pill}
    </Tooltip>
  ) : (
    pill
  );
}

const SEVERITY_COLOR: Record<ProblemSeverity, string> = {
  critical: "error.main",
  warning: "warning.main",
  info: "text.secondary",
};

// Decodes a course's stored JSON checkpoint-name sequence, e.g.
// `["START","31","32","FINISH"]`. Malformed/empty input yields an empty list.
function parseCheckpoints(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

// ─── Passings wrap block ─────────────────────────────────────

function PassingsStrip({
  passings,
  eventId,
  startTimestamp,
  onMenuAction,
  onAfterToggle,
}: {
  passings: Passing[];
  eventId: string;
  startTimestamp?: number | null;
  onMenuAction: (
    action: "edit" | "add-before" | "add-after",
    index: number,
  ) => void;
  onAfterToggle: () => void;
}) {
  const { t } = useTranslation();
  const deltas = computeDeltas(passings, startTimestamp);

  // GapIndicator total width: 6px + 2px margin each side = 10px
  const GAP_W = 10;

  return (
    <Stack spacing={0.5}>
      <ViewLabel>{t("competitors.view.passings", { count: passings.length })}</ViewLabel>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          rowGap: 0.5,
          alignItems: "stretch",
          pl: `${GAP_W}px`,
        }}
      >
        {passings.map((p, i) => (
          <Box
            key={p.id}
            sx={{
              height: 48,
              display: "flex",
              alignItems: "stretch",
              ...(i === 0 && { ml: `-${GAP_W}px` }),
            }}
          >
            {i === 0 && (
              <GapIndicator onClick={() => onMenuAction("add-before", 0)} />
            )}
            <InteractivePassingBlock
              passing={p}
              delta={deltas[i]}
              eventId={eventId}
              onMenuAction={(action) => onMenuAction(action, i)}
              onAfterToggle={onAfterToggle}
            />
            <GapIndicator onClick={() => onMenuAction("add-after", i)} />
          </Box>
        ))}
      </Box>
    </Stack>
  );
}

// ─── View Mode ───────────────────────────────────────────────

const START_SOURCE_KEY: Record<StartSource, string> = {
  competitor: "competitors.view.startSource.competitor",
  group: "competitors.view.startSource.group",
  course: "competitors.view.startSource.course",
  punch: "competitors.view.startSource.punch",
  none: "competitors.view.startSource.none",
};

/**
 * The competitor's "scoring" course: the course inherited from the group (walking
 * the parent chain), falling back to the competitor's own redefined course.
 */
function scoringCourseId(c: Competitor, groups: Map<string, Group>): string {
  const seen = new Set<string>();
  let g = c.groupId ? groups.get(c.groupId) : undefined;
  while (g && !seen.has(g.id)) {
    seen.add(g.id);
    if (g.courseId) return g.courseId;
    g = g.parentId ? groups.get(g.parentId) : undefined;
  }
  return c.courseId;
}

function ViewContent({
  competitor,
  passings,
  passingsLoading,
  eventId,
  onPassingsChanged,
  onCompetitorUpdated,
  withPassings,
  groups,
  courses,
  teams,
}: {
  competitor: Competitor;
  passings: Passing[];
  passingsLoading: boolean;
  eventId: string;
  onPassingsChanged: () => void;
  onCompetitorUpdated: () => void;
  withPassings: boolean;
  groups: Map<string, Group>;
  courses: Map<string, Course>;
  teams: Map<string, Team>;
}) {
  const { t } = useTranslation();
  const c = competitor;
  const { date: baseDate, timezone, settings } = useEvent();
  const [editorState, setEditorState] = useState<{
    mode: "edit" | "add-before" | "add-after";
    index: number;
  } | null>(null);
  const card = c.card1 || c.card2;

  // Earliest enabled punch — lets the start cascade fall back to "first punch".
  const firstPunch = useMemo(() => {
    const times = passings
      .filter((p) => p.enabled !== 0 && p.timestamp > 0)
      .map((p) => p.timestamp);
    return times.length ? Math.min(...times) : null;
  }, [passings]);

  const resolved = resolveStartTimeWithSource(c, groups, courses, firstPunch);
  // Passings strip keeps the classic cascade (no punch fallback) so deltas stay
  // relative to a real start, not the first punch itself.
  const effectiveStartTime = resolveStartTime(c, groups, courses) || null;

  // Resolved relational names.
  const groupName = c.groupId ? groups.get(c.groupId)?.name ?? c.groupId : "";
  const teamName = c.teamId ? teams.get(c.teamId)?.name ?? c.teamId : "";
  const scoringId = scoringCourseId(c, groups);
  const scoringName = scoringId ? courses.get(scoringId)?.name ?? scoringId : "";

  // Status quick-toggle write-through.
  const [statusSaving, setStatusSaving] = useState(false);
  const toggleStatus = async (key: "dsq" | "dnf" | "dns") => {
    if (statusSaving) return;
    setStatusSaving(true);
    try {
      await api.put(`/api/events/${eventId}/competitors/${c.id}`, {
        ...competitorToPayload(c),
        [key]: c[key] === 1 ? 0 : 1,
      });
      onCompetitorUpdated();
    } catch {
      /* leave the view unchanged on failure */
    } finally {
      setStatusSaving(false);
    }
  };
  const statusManual = c.dsq === 1 || c.dns === 1 || c.dnf === 1;

  // Computed result (event-token endpoint). Skipped gracefully without a token.
  const resultsToken = settings.token ?? "";
  const [allResults, setAllResults] = useState<ResultRowDTO[]>([]);
  useEffect(() => {
    if (!resultsToken || !eventId) {
      setAllResults([]);
      return;
    }
    let cancelled = false;
    fetch(
      `/api/events/${eventId}/results?token=${encodeURIComponent(resultsToken)}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("results"))))
      .then((data: { results?: ResultRowDTO[] }) => {
        if (!cancelled) setAllResults(data.results ?? []);
      })
      .catch(() => {
        if (!cancelled) setAllResults([]);
      });
    return () => {
      cancelled = true;
    };
    // `passings` is a dep because the result is computed on the fly from punches:
    // editing/enabling a passing must re-fetch the result (else «Снят» lingers).
  }, [resultsToken, eventId, c.id, c.updatedAt, passings]);

  const result = useMemo(
    () => allResults.find((r) => r.competitorId === c.id) ?? null,
    [allResults, c.id],
  );
  // Place within the competitor's own group (the /results place is per course).
  const groupPlace = useMemo(() => {
    if (!result || result.place <= 0) return 0;
    const ranked = allResults
      .filter((r) => r.groupId === result.groupId && r.place > 0)
      .sort((a, b) => a.totalTime - b.totalTime);
    const idx = ranked.findIndex((r) => r.competitorId === c.id);
    return idx >= 0 ? idx + 1 : 0;
  }, [allResults, result, c.id]);

  const fullName = [c.lastName, c.firstName, c.middleName]
    .filter(Boolean)
    .join(" ");
  const distanceName = groupName || scoringName;
  const genderValue =
    c.gender === "M"
      ? t("competitors.view.male")
      : c.gender === "F"
        ? t("competitors.view.female")
        : "";
  const location = [c.region, c.city].filter(Boolean).join(", ");
  const effCode = effectiveStatusCode(c, result);

  // Problems affecting this competitor — drives the broken-order note and the
  // problems list. Refetched when the competitor or its passings change.
  const [problems, setProblems] = useState<Problem[]>([]);
  useEffect(() => {
    if (!eventId) {
      setProblems([]);
      return;
    }
    let cancelled = false;
    api
      .get<ProblemsResponse>(`/api/events/${eventId}/problems`)
      .then((data) => {
        if (cancelled) return;
        setProblems(
          (data.problems ?? []).filter(
            (p) => p.subject.type === "competitor" && p.subject.id === c.id,
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setProblems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, c.id, c.updatedAt, passings]);

  const brokenOrder = problems.some((p) => p.kind === "competitorBrokenOrder");
  const expectedOrder = parseCheckpoints(courses.get(scoringId)?.checkpoints);

  // ── 1. Header: bib, name, distance, effective-status badge ──
  const headerNode = (
    <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
      {c.bib && (
        <Typography sx={{ fontSize: "3rem", fontWeight: 700, lineHeight: 1 }}>
          {c.bib}
        </Typography>
      )}
      <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "1.4rem", fontWeight: 600 }}>
          {fullName || "—"}
        </Typography>
        {distanceName && (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {distanceName}
          </Typography>
        )}
      </Stack>
      {effCode && (
        <Stack spacing={0.25} sx={{ alignItems: "flex-end", flexShrink: 0 }}>
          <StatusBadge
            code={effCode}
            tooltip={
              effCode === "DSQ" && c.dsqDescription
                ? c.dsqDescription
                : undefined
            }
          />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {statusManual
              ? t("competitors.view.statusManual")
              : t("competitors.view.statusComputed")}
          </Typography>
        </Stack>
      )}
    </Stack>
  );

  // ── 2. Status override switches (write-through) ──
  const statusNode = (
    <Stack spacing={0}>
      <SectionTitle>{t("competitors.view.status")}</SectionTitle>
      {(["dsq", "dnf", "dns"] as const).map((k) => (
        <Stack
          key={k}
          direction="row"
          sx={{
            justifyContent: "space-between",
            alignItems: "center",
            py: 0.25,
            mx: -1.5,
            px: 1.5,
            borderBottom: 1,
            borderColor: "divider",
            "&:last-child": { borderBottom: 0 },
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Typography variant="body2">
            <Box component="span" sx={{ fontWeight: 700 }}>
              {k.toUpperCase()}
            </Box>{" "}
            ({t(`competitors.view.statusWord.${k}`)})
          </Typography>
          <Switch
            size="small"
            checked={c[k] === 1}
            disabled={statusSaving}
            onChange={() => toggleStatus(k)}
          />
        </Stack>
      ))}
    </Stack>
  );

  // ── 3. Data section (label-left / value-right rows) ──
  const dataNode = (
    <Stack spacing={0}>
      <SectionTitle>{t("competitors.view.data")}</SectionTitle>
      <DataRow label={t("competitors.view.start")}>
        {resolved.time > 0 ? (
          <Stack sx={{ alignItems: "flex-end" }}>
            <Typography sx={{ fontWeight: 600 }}>
              <Time
                value={resolved.time}
                baseDate={baseDate}
                timezone={timezone}
              />
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {t(START_SOURCE_KEY[resolved.source])}
            </Typography>
          </Stack>
        ) : (
          <Typography sx={{ color: "text.secondary" }}>
            {t(START_SOURCE_KEY.none)}
          </Typography>
        )}
      </DataRow>
      {groupName && (
        <DataRow label={t("competitors.fields.group")}>
          <ViewValue>{groupName}</ViewValue>
        </DataRow>
      )}
      {scoringName && (
        <DataRow label={t("competitors.view.scoringDistance")}>
          <ViewValue>{scoringName}</ViewValue>
        </DataRow>
      )}
      {teamName && (
        <DataRow label={t("competitors.fields.team")}>
          <ViewValue>{teamName}</ViewValue>
        </DataRow>
      )}
      {genderValue && (
        <DataRow label={t("competitors.fields.gender")}>
          <ViewValue>{genderValue}</ViewValue>
        </DataRow>
      )}
      {c.birthDate && (
        <DataRow label={t("competitors.fields.birthDate")}>
          <ViewValue>{c.birthDate}</ViewValue>
        </DataRow>
      )}
      {c.birthYear ? (
        <DataRow label={t("competitors.fields.birthYear")}>
          <ViewValue>{c.birthYear}</ViewValue>
        </DataRow>
      ) : null}
      {c.rank && (
        <DataRow label={t("competitors.fields.rank")}>
          <ViewValue>{c.rank}</ViewValue>
        </DataRow>
      )}
      {c.rating ? (
        <DataRow label={t("competitors.fields.rating")}>
          <ViewValue>{c.rating}</ViewValue>
        </DataRow>
      ) : null}
      {(c.card1 || c.card2) && (
        <DataRow label={t("competitors.fields.cards")}>
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}
          >
            {c.card1 && <Chip label={c.card1} size="small" color="success" />}
            {c.card2 && <Chip label={c.card2} size="small" color="success" />}
          </Stack>
        </DataRow>
      )}
      {location && (
        <DataRow label={t("competitors.view.location")}>
          <ViewValue>{location}</ViewValue>
        </DataRow>
      )}
      {c.country && (
        <DataRow label={t("competitors.columns.country")}>
          <CountryValue value={c.country} />
        </DataRow>
      )}
      <DataRow label={t("competitors.fields.isCheckin")}>
        <ViewValue>
          {c.isCheckin === 1 ? t("common.yes") : t("common.no")}
        </ViewValue>
      </DataRow>
      {c.timeAdjustment ? (
        <DataRow label={t("competitors.fields.timeAdjustment")}>
          <ViewValue>{c.timeAdjustment}</ViewValue>
        </DataRow>
      ) : null}
      {c.phone && (
        <DataRow label={t("competitors.fields.phone")}>
          <ViewValue>{c.phone}</ViewValue>
        </DataRow>
      )}
      {c.email && (
        <DataRow label={t("competitors.fields.email")}>
          <ViewValue>{c.email}</ViewValue>
        </DataRow>
      )}
      {c.notes && (
        <Stack
          direction="row"
          spacing={2}
          sx={{
            py: 0.75,
            mx: -1.5,
            px: 1.5,
            alignItems: "baseline",
            borderBottom: 1,
            borderColor: "divider",
            "&:last-child": { borderBottom: 0 },
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", width: "30%", flexShrink: 0 }}
          >
            {t("common.notes")}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              width: "70%",
              textAlign: "right",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {c.notes}
          </Typography>
        </Stack>
      )}
    </Stack>
  );

  // ── 4. Result section (status, total time, place — no splits) ──
  const resultNode = result ? (
    <Stack spacing={0.5}>
      <SectionTitle>{t("competitors.view.result")}</SectionTitle>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "center", flexWrap: "wrap" }}
      >
        {effCode && <StatusBadge code={effCode} />}
        {result.totalTime > 0 && (
          <Typography>
            {t("competitors.view.total")}: {formatDuration(result.totalTime)}
          </Typography>
        )}
        {groupPlace > 0 && (
          <Typography sx={{ color: "text.secondary" }}>
            {t("competitors.view.placeInGroup")}: {groupPlace}
          </Typography>
        )}
        {result.place > 0 && (
          <Typography sx={{ color: "text.secondary" }}>
            {t("competitors.view.placeInCourse")}: {result.place}
          </Typography>
        )}
      </Stack>
    </Stack>
  ) : null;

  // ── 5. Passings strip + broken-order note / expected order ──
  const showPassings =
    withPassings && (passingsLoading || passings.length > 0 || !!card);
  const passingsNode = showPassings ? (
    <Stack spacing={1}>
      {passingsLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      {!passingsLoading && passings.length > 0 && (
        <>
          <PassingsStrip
            passings={passings}
            eventId={eventId}
            startTimestamp={effectiveStartTime}
            onMenuAction={(action, index) =>
              setEditorState({ mode: action, index })
            }
            onAfterToggle={onPassingsChanged}
          />
          {brokenOrder && expectedOrder.length > 0 && (
            <Stack spacing={0.25}>
              <Typography
                variant="body2"
                sx={{ color: "error.main", fontWeight: 600 }}
              >
                {t("competitors.view.brokenOrder")}
              </Typography>
              <ViewLabel>{t("competitors.view.expectedOrder")}</ViewLabel>
              <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                {expectedOrder.join(" → ")}
              </Typography>
            </Stack>
          )}
        </>
      )}
      {!passingsLoading && passings.length === 0 && card && (
        <Stack spacing={0.5}>
          <ViewLabel>{t("competitors.view.passings", { count: 0 })}</ViewLabel>
          <Button
            size="small"
            variant="outlined"
            sx={{ alignSelf: "flex-start" }}
            onClick={() => setEditorState({ mode: "add-before", index: 0 })}
          >
            {t("competitors.addPassing")}
          </Button>
        </Stack>
      )}
      {editorState && card && (
        <PassingsEditor
          open
          onClose={() => setEditorState(null)}
          eventId={eventId}
          card={card}
          passings={passings}
          initialIndex={editorState.index}
          initialMode={editorState.mode}
          onAfterSave={onPassingsChanged}
          startTimestamp={effectiveStartTime}
        />
      )}
    </Stack>
  ) : null;

  // ── 6. Problems affecting this competitor ──
  const problemsNode =
    problems.length > 0 ? (
      <Stack spacing={0.75}>
        <SectionTitle>{t("competitors.view.problemsTitle")}</SectionTitle>
        <Stack spacing={0.5}>
          {problems.map((p) => (
            <Stack
              key={p.id}
              direction="row"
              spacing={1}
              sx={{ alignItems: "flex-start" }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: SEVERITY_COLOR[p.severity],
                  mt: "6px",
                  flexShrink: 0,
                }}
              />
              <Typography variant="body2">
                {problemTitle(t, p.kind, p.params)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>
    ) : null;

  const sections = [
    headerNode,
    statusNode,
    dataNode,
    resultNode,
    passingsNode,
    problemsNode,
  ].filter(Boolean);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 200 }}>
      {sections.map((node, i) => (
        <Box
          key={i}
          sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.5 }}
        >
          {node}
        </Box>
      ))}
    </Box>
  );
}

// ─── Edit / Create Form ──────────────────────────────────────

// House style: plain outlined inputs. `filled` reserves ~25px of top padding for
// a floating label we never use (the label lives above, in <Field>), which showed
// up as a big empty gap at the top of every field — hence outlined.
const V = "outlined" as const;

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
        onChange={(_, v) => onChange(v ? v.id : "")}
        disabled={disabled}
        fullWidth
        renderInput={(params) => <TextField {...params} variant={V} placeholder={label} />}
      />
    </Field>
  );
}

function EditForm({
  control,
  errors,
  saving,
  groupOptions,
  courseOptions,
  teamOptions,
}: {
  control: ReturnType<typeof useForm<CompetitorFormData>>["control"];
  errors: ReturnType<typeof useForm<CompetitorFormData>>["formState"]["errors"];
  saving: boolean;
  groupOptions: PickerOption[];
  courseOptions: PickerOption[];
  teamOptions: PickerOption[];
}) {
  const { t } = useTranslation();
  const { date: baseDate, timezone } = useEvent();
  return (
    <Stack spacing={2}>
      {/* ── Person ── */}
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        {/* Bib — top of left column */}
        <Stack spacing={1}>
          <Controller
            name="bib"
            control={control}
            render={({ field }) => (
              <Field label={t("competitors.fields.bib")}>
                <TextField
                  {...field}
                  variant={V}
                  fullWidth
                  size="small"
                  disabled={saving}
                />
              </Field>
            )}
          />
        </Stack>

        {/* Name */}
        <Stack spacing={1}>
          <Stack spacing={1}>
            <Controller
              name="lastName"
              control={control}
              render={({ field }) => (
                <Field label={t("competitors.fields.lastName")} required error={!!errors.lastName}>
                  <TextField
                    {...field}
                    variant={V}
                    required
                    fullWidth
                    size="small"
                    error={!!errors.lastName}
                    helperText={errors.lastName?.message as string}
                    disabled={saving}
                  />
                </Field>
              )}
            />
            <Controller
              name="firstName"
              control={control}
              render={({ field }) => (
                <Field label={t("competitors.fields.firstName")}>
                  <TextField
                    {...field}
                    variant={V}
                    fullWidth
                    size="small"
                    disabled={saving}
                  />
                </Field>
              )}
            />
          </Stack>
          <Stack spacing={1}>
            <Controller
              name="gender"
              control={control}
              render={({ field }) => (
                <Field label={t("competitors.fields.gender")}>
                  <TextField
                    {...field}
                    variant={V}
                    size="small"
                    select
                    disabled={saving}
                    fullWidth
                  >
                    <MenuItem value="">—</MenuItem>
                    <MenuItem value="M">M</MenuItem>
                    <MenuItem value="F">F</MenuItem>
                  </TextField>
                </Field>
              )}
            />
            <Controller
              name="birthDate"
              control={control}
              render={({ field }) => (
                <Field label={t("competitors.fields.birthDate")}>
                <TextField
                  {...field}
                  onChange={(e) => {
                    let v = e.target.value.replace(/[^\d.]/g, "");
                    // Auto-insert dot after 2 digits
                    const digits = v.replace(/\./g, "");
                    if (digits.length >= 2 && !v.includes(".")) {
                      v = digits.slice(0, 2) + "." + digits.slice(2);
                    }
                    // Limit to dd.mm format
                    if (v.length > 5) v = v.slice(0, 5);
                    field.onChange(v);
                  }}
                  variant={V}
                  size="small"
                  placeholder={t("competitors.placeholders.birthDate")}
                  inputMode="numeric"
                  error={!!errors.birthDate}
                  helperText={errors.birthDate?.message as string}
                  disabled={saving}
                  fullWidth
                />
                </Field>
              )}
            />
            <Controller
              name="birthYear"
              control={control}
              render={({ field }) => (
                <Field label={t("competitors.fields.birthYear")}>
                <TextField
                  {...field}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    field.onChange(v);
                  }}
                  variant={V}
                  size="small"
                  placeholder={t("competitors.placeholders.birthYear")}
                  inputMode="numeric"
                  error={!!errors.birthYear}
                  helperText={errors.birthYear?.message as string}
                  disabled={saving}
                  fullWidth
                  sx={{
                    "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button":
                      { display: "none" },
                    "& input[type=number]": { MozAppearance: "textfield" },
                  }}
                />
                </Field>
              )}
            />
          </Stack>
        </Stack>

        {/* Group & Distance */}
        <Stack spacing={1}>
          <SectionTitle>{t("competitors.sections.groupAndDistance")}</SectionTitle>
          <Controller
            name="groupId"
            control={control}
            render={({ field }) => (
              <EntityPicker
                label={t("competitors.fields.group")}
                value={field.value}
                onChange={field.onChange}
                options={groupOptions}
                disabled={saving}
              />
            )}
          />
          <Controller
            name="courseId"
            control={control}
            render={({ field }) => (
              <EntityPicker
                label={t("competitors.fields.courseRedefined")}
                value={field.value}
                onChange={field.onChange}
                options={courseOptions}
                disabled={saving}
              />
            )}
          />
        </Stack>

        {/* More — collapsible */}
        <CollapsibleSection title={t("common.more")}>
          <Stack spacing={1}>
            <Controller
              name="middleName"
              control={control}
              render={({ field }) => (
                <Field label={t("competitors.fields.middleName")}>
                  <TextField
                    {...field}
                    variant={V}
                    fullWidth
                    size="small"
                    disabled={saving}
                  />
                </Field>
              )}
            />
            <Stack spacing={1}>
              <Controller
                name="lastNameInt"
                control={control}
                render={({ field }) => (
                  <Field label={t("competitors.fields.lastNameInt")}>
                    <TextField
                      {...field}
                      variant={V}
                      fullWidth
                      size="small"
                      disabled={saving}
                    />
                  </Field>
                )}
              />
              <Controller
                name="firstNameInt"
                control={control}
                render={({ field }) => (
                  <Field label={t("competitors.fields.firstNameInt")}>
                    <TextField
                      {...field}
                      variant={V}
                      fullWidth
                      size="small"
                      disabled={saving}
                    />
                  </Field>
                )}
              />
            </Stack>
            <Stack spacing={1}>
              <Controller
                name="rank"
                control={control}
                render={({ field }) => (
                  <Field label={t("competitors.fields.rank")}>
                    <TextField
                      {...field}
                      variant={V}
                      fullWidth
                      size="small"
                      disabled={saving}
                    />
                  </Field>
                )}
              />
              <Controller
                name="rating"
                control={control}
                render={({ field }) => (
                  <Field label={t("competitors.fields.rating")} error={!!errors.rating}>
                    <TextField
                      {...field}
                      variant={V}
                      fullWidth
                      size="small"
                      type="number"
                      error={!!errors.rating}
                      helperText={errors.rating?.message as string}
                      disabled={saving}
                    />
                  </Field>
                )}
              />
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{
              flexWrap: "wrap"
            }}>
              <Controller
                name="dsq"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value === 1}
                        onChange={(_, checked) =>
                          field.onChange(checked ? 1 : 0)
                        }
                        size="small"
                        disabled={saving}
                      />
                    }
                    label="DSQ"
                  />
                )}
              />
              <Controller
                name="dns"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value === 1}
                        onChange={(_, checked) =>
                          field.onChange(checked ? 1 : 0)
                        }
                        size="small"
                        disabled={saving}
                      />
                    }
                    label="DNS"
                  />
                )}
              />
              <Controller
                name="dnf"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value === 1}
                        onChange={(_, checked) =>
                          field.onChange(checked ? 1 : 0)
                        }
                        size="small"
                        disabled={saving}
                      />
                    }
                    label="DNF"
                  />
                )}
              />
              <Controller
                name="outOfRank"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value === 1}
                        onChange={(_, checked) =>
                          field.onChange(checked ? 1 : 0)
                        }
                        size="small"
                        disabled={saving}
                      />
                    }
                    label={t("competitors.fields.outOfRank")}
                  />
                )}
              />
            </Stack>
            <Controller
              name="dsqDescription"
              control={control}
              render={({ field }) => (
                <Field label={t("competitors.fields.dsqDescription")}>
                  <TextField
                    {...field}
                    variant={V}
                    fullWidth
                    size="small"
                    disabled={saving}
                  />
                </Field>
              )}
            />
          </Stack>
        </CollapsibleSection>
      </Stack>
      {/* ── Competition ── */}
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        {/* Start time — full width, no section title */}
        <Controller
          name="startTime"
          control={control}
          render={({ field }) => (
            <Field label={t("competitors.fields.startTimeRedefined")}>
              <TimeInput
                value={field.value || null}
                baseDate={baseDate}
                timezone={timezone}
                onChange={(ts) => field.onChange(ts ?? 0)}
                variant={V}
                size="small"
                disabled={saving}
                fullWidth
                allowChangeDate
              />
            </Field>
          )}
        />

        {/* Time adjustment (+penalty / −handicap, seconds) */}
        <Controller
          name="timeAdjustment"
          control={control}
          render={({ field }) => (
            <Field label={t("competitors.fields.timeAdjustment")} error={!!errors.timeAdjustment}>
              <TextField
                {...field}
                variant={V}
                type="number"
                size="small"
                fullWidth
                error={!!errors.timeAdjustment}
                helperText={
                  (errors.timeAdjustment?.message as string) ||
                  t("competitors.fields.timeAdjustmentHelp")
                }
                disabled={saving}
              />
            </Field>
          )}
        />

        {/* Cards */}
        <Stack spacing={1}>
          <Stack spacing={1}>
            <Controller
              name="card1"
              control={control}
              render={({ field }) => (
                <Field label={t("competitors.fields.card1")}>
                  <TextField
                    {...field}
                    variant={V}
                    fullWidth
                    size="small"
                    disabled={saving}
                  />
                </Field>
              )}
            />
            <Controller
              name="card2"
              control={control}
              render={({ field }) => (
                <Field label={t("competitors.fields.card2")}>
                  <TextField
                    {...field}
                    variant={V}
                    fullWidth
                    size="small"
                    disabled={saving}
                  />
                </Field>
              )}
            />
          </Stack>
        </Stack>

        {/* Team */}
        <Stack spacing={1}>
          <SectionTitle>{t("competitors.fields.team")}</SectionTitle>
          <Stack spacing={1}>
            <Controller
              name="teamId"
              control={control}
              render={({ field }) => (
                <EntityPicker
                  label={t("competitors.fields.team")}
                  value={field.value}
                  onChange={field.onChange}
                  options={teamOptions}
                  disabled={saving}
                />
              )}
            />
            <Controller
              name="country"
              control={control}
              render={({ field }) => (
                <CountryPicker
                  value={field.value}
                  onChange={field.onChange}
                  variant={V}
                  size="small"
                  disabled={saving}
                  fullWidth
                />
              )}
            />
          </Stack>
          <Stack spacing={1}>
            <Controller
              name="region"
              control={control}
              render={({ field }) => (
                <Field label={t("competitors.fields.region")}>
                  <TextField
                    {...field}
                    variant={V}
                    fullWidth
                    size="small"
                    disabled={saving}
                  />
                </Field>
              )}
            />
            <Controller
              name="city"
              control={control}
              render={({ field }) => (
                <Field label={t("competitors.fields.city")}>
                  <TextField
                    {...field}
                    variant={V}
                    fullWidth
                    size="small"
                    disabled={saving}
                  />
                </Field>
              )}
            />
          </Stack>
        </Stack>

        {/* Contacts */}
        <Stack spacing={1}>
          <SectionTitle>{t("competitors.sections.contacts")}</SectionTitle>
          <Stack spacing={1}>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <Field label={t("competitors.fields.phone")}>
                  <TextField
                    {...field}
                    variant={V}
                    fullWidth
                    size="small"
                    disabled={saving}
                  />
                </Field>
              )}
            />
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <Field label={t("competitors.fields.email")} error={!!errors.email}>
                  <TextField
                    {...field}
                    variant={V}
                    fullWidth
                    size="small"
                    error={!!errors.email}
                    helperText={errors.email?.message as string}
                    disabled={saving}
                  />
                </Field>
              )}
            />
          </Stack>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <Field label={t("common.notes")}>
                <TextField
                  {...field}
                  variant={V}
                  fullWidth
                  size="small"
                  multiline
                  minRows={2}
                  maxRows={4}
                  disabled={saving}
                />
              </Field>
            )}
          />
        </Stack>

        {/* Registration & payment */}
        <Stack spacing={1}>
          <SectionTitle>{t("competitors.sections.registration")}</SectionTitle>
          <Stack spacing={1}>
            <Controller
              name="entryNumber"
              control={control}
              render={({ field }) => (
                <Field label={t("competitors.fields.entryNumber")}>
                  <TextField
                    {...field}
                    variant={V}
                    fullWidth
                    size="small"
                    disabled={saving}
                  />
                </Field>
              )}
            />
            <Controller
              name="price"
              control={control}
              render={({ field }) => (
                <Field label={t("competitors.fields.price")} error={!!errors.price}>
                  <TextField
                    {...field}
                    variant={V}
                    type="number"
                    fullWidth
                    size="small"
                    error={!!errors.price}
                    helperText={errors.price?.message as string}
                    disabled={saving}
                  />
                </Field>
              )}
            />
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
            <Controller
              name="isPaid"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value === 1}
                      onChange={(_, checked) => field.onChange(checked ? 1 : 0)}
                      size="small"
                      disabled={saving}
                    />
                  }
                  label={t("competitors.fields.isPaid")}
                />
              )}
            />
            <Controller
              name="isCheckin"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value === 1}
                      onChange={(_, checked) => field.onChange(checked ? 1 : 0)}
                      size="small"
                      disabled={saving}
                    />
                  }
                  label={t("competitors.fields.isCheckin")}
                />
              )}
            />
          </Stack>
        </Stack>
      </Stack>
    </Stack>
  );
}

// ─── Main Dialog ─────────────────────────────────────────────

export function CompetitorDialog({
  open,
  mode,
  onClose,
  onSaved,
  onEditClick,
  eventId,
  competitorId,
  competitor,
  withPassings = true,
}: CompetitorDialogProps) {
  const { t } = useTranslation();
  const schema = useMemo(() => buildSchema(t), [t]);
  const isView = mode === "view";
  const isEdit = mode === "edit";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passings, setPassings] = useState<Passing[]>([]);
  const [passingsLoading, setPassingsLoading] = useState(false);
  const [groupsMap, setGroupsMap] = useState<Map<string, Group>>(new Map());
  const [coursesMap, setCoursesMap] = useState<Map<string, Course>>(new Map());
  const [teamsMap, setTeamsMap] = useState<Map<string, Team>>(new Map());

  // Relational picker options for the edit/create form.
  const [groupOptions, setGroupOptions] = useState<Group[]>([]);
  const [courseOptions, setCourseOptions] = useState<Course[]>([]);
  const [teamOptions, setTeamOptions] = useState<Team[]>([]);

  // Fresh competitor data fetched from API on open (view mode).
  const [fetchedCompetitor, setFetchedCompetitor] = useState<Competitor | null>(
    null,
  );
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [competitorError, setCompetitorError] = useState<string | null>(null);

  // Loading state for edit mode (re-fetch before populating the form).
  const [editLoading, setEditLoading] = useState(false);

  // Resolve the ID: explicit competitorId prop, or from competitor object.
  const resolvedId = competitorId ?? competitor?.id ?? null;

  // In view mode, use fetched data. In edit/create, use the prop.
  const viewCompetitor = fetchedCompetitor;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CompetitorFormData>({
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
    api
      .get<Competitor>(`/api/events/${eventId}/competitors/${resolvedId}`)
      .then(setFetchedCompetitor)
      .catch((err) => {
        setFetchedCompetitor(null);
        setCompetitorError(
          err instanceof Error ? err.message : t("competitors.errors.loadOne"),
        );
      })
      .finally(() => setCompetitorLoading(false));
    // `t` intentionally omitted: a language switch must not re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isView, resolvedId, eventId]);

  // Silent re-fetch of the viewed competitor (no loading spinner) — used after a
  // status quick-toggle writes through, so the view reflects the new flags.
  const refreshViewCompetitor = useCallback(() => {
    if (!eventId || !resolvedId) return;
    api
      .get<Competitor>(`/api/events/${eventId}/competitors/${resolvedId}`)
      .then(setFetchedCompetitor)
      .catch(() => {
        /* keep the current view on transient failure */
      });
  }, [eventId, resolvedId]);

  useEffect(() => {
    if (!open || isView) return;
    setError(null);

    if (resolvedId && eventId) {
      // Always re-fetch from API to get the freshest data.
      setEditLoading(true);
      api
        .get<Competitor>(`/api/events/${eventId}/competitors/${resolvedId}`)
        .then((data) => {
          reset(competitorToForm(data));
        })
        .catch((err) => {
          // Fallback to prop data if available.
          reset(competitor ? competitorToForm(competitor) : DEFAULT_VALUES);
          setError(
            err instanceof Error
              ? err.message
              : t("competitors.errors.loadData"),
          );
        })
        .finally(() => setEditLoading(false));
    } else {
      reset(competitor ? competitorToForm(competitor) : DEFAULT_VALUES);
    }
    // `t` intentionally omitted: a language switch must not re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, resolvedId, eventId, competitor, reset, isView]);

  const fetchPassings = useCallback(() => {
    if (!eventId || !fetchedCompetitor) return;
    const cards: string[] = [];
    if (fetchedCompetitor.card1) cards.push(fetchedCompetitor.card1);
    if (fetchedCompetitor.card2) cards.push(fetchedCompetitor.card2);
    if (!cards.length) {
      setPassings([]);
      return;
    }
    setPassingsLoading(true);
    const params = new URLSearchParams();
    cards.forEach((card) => params.append("card", card));
    api
      .get<Passing[]>(`/api/events/${eventId}/passings?${params.toString()}`)
      .then(setPassings)
      .catch(() => setPassings([]))
      .finally(() => setPassingsLoading(false));
  }, [eventId, fetchedCompetitor]);

  useEffect(() => {
    if (!open || !isView || !withPassings || !fetchedCompetitor) {
      setPassings([]);
      return;
    }
    fetchPassings();
  }, [open, isView, withPassings, fetchedCompetitor, fetchPassings]);

  // Fetch groups / courses / teams for name resolution and start-time cascade.
  useEffect(() => {
    if (!open || !isView || !eventId) return;
    Promise.all([
      api.get<Group[]>(`/api/events/${eventId}/groups`),
      api.get<Course[]>(`/api/events/${eventId}/courses`),
      api.get<Team[]>(`/api/events/${eventId}/teams`),
    ])
      .then(([groups, courses, teams]) => {
        setGroupsMap(new Map(groups.map((g) => [g.id, g])));
        setCoursesMap(new Map(courses.map((c) => [c.id, c])));
        setTeamsMap(new Map(teams.map((tm) => [tm.id, tm])));
      })
      .catch(() => {
        /* non-critical */
      });
  }, [open, isView, eventId]);

  // Load relational picker options (groups/courses/teams) for edit/create.
  useEffect(() => {
    if (!open || isView || !eventId) return;
    Promise.all([
      api.get<Group[]>(`/api/events/${eventId}/groups`),
      api.get<Course[]>(`/api/events/${eventId}/courses`),
      api.get<Team[]>(`/api/events/${eventId}/teams`),
    ])
      .then(([groups, courses, teams]) => {
        setGroupOptions(groups);
        setCourseOptions(courses);
        setTeamOptions(teams);
      })
      .catch(() => {
        /* non-critical */
      });
  }, [open, isView, eventId]);

  const onSubmit = async (data: CompetitorFormData) => {
    setSaving(true);
    setError(null);
    try {
      const payload = formToPayload(data);
      if (isEdit && resolvedId) {
        await api.put(
          `/api/events/${eventId}/competitors/${resolvedId}`,
          payload,
        );
      } else {
        await api.post(`/api/events/${eventId}/competitors`, payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("competitors.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const competitorName = viewCompetitor
    ? [viewCompetitor.lastName, viewCompetitor.firstName]
        .filter(Boolean)
        .join(" ") || t("competitors.dialog.competitor")
    : "";

  const title = isView
    ? competitorName || t("competitors.dialog.competitor")
    : isEdit
      ? t("competitors.dialog.editTitle")
      : t("competitors.dialog.createTitle");

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
      slotProps={{
        // Edit/create: pin the modal to (almost) full height so the header and the
        // Save/Cancel footer stay put while only the middle scrolls. View: natural.
        paper: { sx: { height: isView ? "auto" : "calc(100% - 64px)" } },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          py: 1.5,
        }}
      >
        <Typography
          variant="h6"
          component="span"
          noWrap
          sx={{ flex: 1, minWidth: 0 }}
        >
          {title}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: 1 }}>
          {isView ? (
            onEditClick && (
              <Button size="small" color="inherit" onClick={onEditClick}>
                {t("common.edit")}
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
          <DialogContent
            dividers
            sx={{
              p: 3,
              borderBottom: "none",
              display: "flex",
              justifyContent: "center",
              minHeight: 200,
              alignItems: "center",
            }}
          >
            <CircularProgress size={32} />
          </DialogContent>
        ) : competitorError ? (
          <DialogContent dividers sx={{ p: 3, borderBottom: "none" }}>
            <Alert severity="error">{competitorError}</Alert>
          </DialogContent>
        ) : viewCompetitor ? (
          <DialogContent dividers sx={{ p: 3, borderBottom: "none" }}>
            <ViewContent
              competitor={viewCompetitor}
              passings={passings}
              passingsLoading={passingsLoading}
              eventId={eventId}
              onPassingsChanged={fetchPassings}
              onCompetitorUpdated={refreshViewCompetitor}
              withPassings={withPassings}
              groups={groupsMap}
              courses={coursesMap}
              teams={teamsMap}
            />
          </DialogContent>
        ) : null
      ) : editLoading ? (
        <DialogContent
          dividers
          sx={{
            p: 3,
            borderBottom: "none",
            display: "flex",
            justifyContent: "center",
            minHeight: 200,
            alignItems: "center",
          }}
        >
          <CircularProgress size={32} />
        </DialogContent>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <DialogContent dividers sx={{ pt: 1, flex: 1, minHeight: 0, overflowY: "auto" }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <EditForm
              control={control}
              errors={errors}
              saving={saving}
              groupOptions={groupOptions}
              courseOptions={courseOptions}
              teamOptions={teamOptions}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 1.5 }}>
            <Button onClick={handleClose} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button variant="contained" type="submit" disabled={saving}>
              {saving ? t("common.saving") : isEdit ? t("common.save") : t("common.create")}
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
