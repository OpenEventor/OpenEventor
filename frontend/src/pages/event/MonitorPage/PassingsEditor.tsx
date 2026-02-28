import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Slider,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import TimeInput from "../../../components/TimeInput";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CircleOutlinedIcon from "@mui/icons-material/CircleOutlined";
import type { Passing } from "../../../api/types";
import { api } from "../../../api/client";
import { renderLock, pauseRefresh } from "./useMonitorStore";

// ── Types ───────────────────────────────────────────────────────────

type InitialMode = "edit" | "add-before" | "add-after";

interface PassingsEditorProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  card: string;
  passings: Passing[];
  initialIndex: number;
  initialMode: InitialMode;
}

interface WorkingPassing {
  id: string;
  checkpoint: string;
  timestamp: number;
  enabled: number;
  isNew: boolean;
  isDirty: boolean;
  original?: Passing;
}

// ── Time helpers ────────────────────────────────────────────────────

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  const cs = String(Math.floor((timestamp % 1) * 100) % 100).padStart(2, "0");
  return `${hh}:${mm}:${ss}.${cs}`;
}

function formatDelta(seconds: number): string {
  const sign = seconds < 0 ? "-" : "+";
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sFixed = s.toFixed(1);
  return m > 0 ? `${sign}${m}:${sFixed.padStart(4, "0")}` : `${sign}${sFixed}`;
}

function parseTime(timeStr: string, referenceTimestamp: number): number | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const centiseconds = match[4] ? parseInt(match[4].padEnd(2, "0"), 10) : 0;

  if (hours > 23 || minutes > 59 || seconds > 59 || centiseconds > 99)
    return null;

  const refDate = new Date(referenceTimestamp * 1000);
  const dayStart =
    Date.UTC(
      refDate.getUTCFullYear(),
      refDate.getUTCMonth(),
      refDate.getUTCDate(),
    ) / 1000;

  return dayStart + hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
}

/** Build initial working list from passings snapshot. */
function buildWorkingList(passings: Passing[]): WorkingPassing[] {
  return passings.map((p) => ({
    id: p.id,
    checkpoint: p.checkpoint,
    timestamp: p.timestamp,
    enabled: p.enabled,
    isNew: false,
    isDirty: false,
    original: p,
  }));
}

/** Create an empty new passing. */
function createNewPassing(): WorkingPassing {
  return {
    id: crypto.randomUUID(),
    checkpoint: "",
    timestamp: 0,
    enabled: 1,
    isNew: true,
    isDirty: false,
  };
}

/** Apply current form values to a working passing item and compute isDirty. */
function applyFormToItem(
  item: WorkingPassing,
  formCheckpoint: string,
  formTime: string,
  formEnabled: boolean,
  fallbackRefTs: number,
): WorkingPassing {
  const result = { ...item };
  const refTs = item.timestamp > 0 ? item.timestamp : fallbackRefTs;
  result.checkpoint = formCheckpoint;
  const parsed = parseTime(formTime, refTs);
  if (parsed !== null) {
    const timeUnchanged = result.original && formTime === formatTime(result.original.timestamp);
    result.timestamp = timeUnchanged ? result.original.timestamp : parsed;
  }
  result.enabled = formEnabled ? 1 : 0;
  if (!result.isNew && result.original) {
    result.isDirty =
      result.checkpoint !== result.original.checkpoint ||
      result.timestamp !== result.original.timestamp ||
      result.enabled !== result.original.enabled;
  }
  return result;
}

/** Compute deltas for a working list (enabled-only logic). */
function computeDeltas(list: WorkingPassing[]): (number | null)[] {
  const deltas: (number | null)[] = [];
  let prevEnabledTs: number | null = null;
  for (const item of list) {
    if (item.enabled === 1 && item.timestamp > 0 && prevEnabledTs !== null) {
      deltas.push(item.timestamp - prevEnabledTs);
    } else {
      deltas.push(null);
    }
    if (item.enabled === 1 && item.timestamp > 0) {
      prevEnabledTs = item.timestamp;
    }
  }
  return deltas;
}

// ── Compact passing row ─────────────────────────────────────────────

interface CompactRowProps {
  item: WorkingPassing;
  delta: number | null;
  onClick: () => void;
  onDelete?: () => void;
  onEmptyClick?: () => void;
  shrinking?: boolean;
}

function CompactRow({ item, delta, onClick, onDelete, onEmptyClick, shrinking }: CompactRowProps) {
  const theme = useTheme();
  const enabled = item.enabled === 1;
  const hasTime = item.timestamp > 0;
  const bgColor = enabled
    ? theme.palette.primary.main
    : theme.palette.mode === "dark"
      ? theme.palette.grey[700]
      : theme.palette.grey[300];
  const textColor = enabled
    ? theme.palette.primary.contrastText
    : theme.palette.text.secondary;

  return (
    <Box onClick={(e) => { if (e.target === e.currentTarget) onEmptyClick?.(); }} sx={{ display: "flex", justifyContent: "center" }}>
      <Box
        onClick={onClick}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          width: 110,
          minHeight: 55,
          px: 1,
          py: 0.5,
          borderRadius: 1,
          bgcolor: bgColor,
          color: textColor,
          cursor: "pointer",
          userSelect: "none",
          position: "relative",
          border: item.isNew ? "1px dashed" : "none",
          borderColor: item.isNew ? "rgba(255,255,255,0.5)" : undefined,
          "&:hover": { filter: "brightness(1.1)" },
          transition: "filter 0.15s",
          "@keyframes shrinkIn": {
            from: { transform: "scale(1.9, 1.8)", opacity: 0 },
            to: { transform: "scale(1)", opacity: 1 },
          },
          animation: shrinking ? "shrinkIn 0.25s ease-out" : undefined,
        }}
      >
        {/* New indicator */}
        {item.isNew && (
          <Box
            sx={{
              position: "absolute",
              top: 3,
              right: 3,
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: "warning.main",
            }}
          />
        )}
        {/* Delete button for new passings */}
        {item.isNew && onDelete && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            sx={{
              position: "absolute",
              top: -6,
              right: -6,
              p: 0,
              color: "error.main",
              bgcolor: "background.paper",
              width: 16,
              height: 16,
              "&:hover": { bgcolor: "error.main", color: "error.contrastText" },
            }}
          >
            <CloseIcon sx={{ fontSize: 12 }} />
          </IconButton>
        )}
        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {item.checkpoint || "—"}
        </Typography>
        <Typography
          variant="caption"
          sx={{ fontFamily: "monospace", lineHeight: 1.2, opacity: 0.9 }}
        >
          {hasTime ? formatTime(item.timestamp) : "—"}
        </Typography>
        {delta !== null && (
          <Typography
            variant="caption"
            sx={{
              fontFamily: "monospace",
              fontSize: "0.65rem",
              lineHeight: 1,
              opacity: 0.7,
            }}
          >
            {formatDelta(delta)}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ── Insertion divider ───────────────────────────────────────────────

function InsertionDivider({ onClick }: { onClick: () => void }) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;

  return (
    <Box
      onClick={onClick}
      sx={{
        height: 4,
        borderRadius: 0.5,
        bgcolor: alpha(primary, 0.3),
        cursor: "pointer",
        mx: "auto",
        width: 110,
        "&:hover": {
          bgcolor: alpha(primary, 0.6),
          height: 8,
        },
        transition: "all 0.15s",
      }}
    />
  );
}

// ── Main component ──────────────────────────────────────────────────

export default function PassingsEditor({
  open,
  onClose,
  eventId,
  card,
  passings,
  initialIndex,
  initialMode,
}: PassingsEditorProps) {
  const theme = useTheme();
  const expandedRef = useRef<HTMLDivElement>(null);

  // Working copy of all passings.
  const [workingList, setWorkingList] = useState<WorkingPassing[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [shrinkingIdx, setShrinkingIdx] = useState<number | null>(null);

  // Form state for the expanded row.
  const [checkpoint, setCheckpoint] = useState("");
  const [time, setTime] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize on open.
  useEffect(() => {
    if (!open) return;

    let list = buildWorkingList(passings);
    let expandIdx = initialIndex;

    if (initialMode === "add-before") {
      const newItem = createNewPassing();
      list.splice(initialIndex, 0, newItem);
      expandIdx = initialIndex;
    } else if (initialMode === "add-after") {
      const newItem = createNewPassing();
      list.splice(initialIndex + 1, 0, newItem);
      expandIdx = initialIndex + 1;
    }

    setWorkingList(list);
    setExpandedIdx(expandIdx);

    const item = list[expandIdx];
    if (item.isNew) {
      setCheckpoint("");
      setTime("");
      setEnabled(true);
    } else {
      setCheckpoint(item.checkpoint);
      setTime(formatTime(item.timestamp));
      setEnabled(item.enabled === 1);
    }
    setError(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Render lock while open.
  useEffect(() => {
    if (!open) return;
    renderLock.lock();
    return () => {
      renderLock.unlock();
    };
  }, [open]);

  // Auto-scroll to expanded row.
  useEffect(() => {
    if (expandedIdx === null) return;
    requestAnimationFrame(() => {
      expandedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [expandedIdx]);

  // Flush current form edits back into workingList.
  const flushCurrentEdit = useCallback(() => {
    if (expandedIdx === null) return;
    setWorkingList((prev) => {
      const copy = [...prev];
      const fallbackRefTs = prev.find((p) => p.timestamp > 0)?.timestamp ?? Date.now() / 1000;
      copy[expandedIdx] = applyFormToItem(copy[expandedIdx], checkpoint, time, enabled, fallbackRefTs);
      return copy;
    });
  }, [expandedIdx, checkpoint, time, enabled]);

  // Collapse expanded row (click on empty space).
  const handleCollapse = useCallback(() => {
    flushCurrentEdit();
    if (expandedIdx !== null) {
      setShrinkingIdx(expandedIdx);
      setTimeout(() => setShrinkingIdx(null), 250);
    }
    setExpandedIdx(null);
  }, [flushCurrentEdit, expandedIdx]);

  // Switch to a different row.
  const handleSelect = useCallback(
    (idx: number) => {
      flushCurrentEdit();
      if (expandedIdx !== null && expandedIdx !== idx) {
        setShrinkingIdx(expandedIdx);
        setTimeout(() => setShrinkingIdx(null), 250);
      }
      const item = workingList[idx];
      if (item.timestamp > 0) {
        setCheckpoint(item.checkpoint);
        setTime(formatTime(item.timestamp));
      } else {
        setCheckpoint(item.checkpoint || "");
        setTime("");
      }
      setEnabled(item.enabled === 1);
      setError(null);
      setExpandedIdx(idx);
    },
    [flushCurrentEdit, workingList, expandedIdx],
  );

  // Insert a new passing at a position.
  const handleInsert = useCallback(
    (insertIdx: number) => {
      flushCurrentEdit();
      const newItem = createNewPassing();
      setWorkingList((prev) => {
        const copy = [...prev];
        copy.splice(insertIdx, 0, newItem);
        return copy;
      });
      setCheckpoint("");
      setTime("");
      setEnabled(true);
      setError(null);
      setExpandedIdx(insertIdx);
    },
    [flushCurrentEdit],
  );

  // Delete a new (unsaved) passing.
  const handleDeleteNew = useCallback(
    (idx: number) => {
      setWorkingList((prev) => {
        const copy = [...prev];
        copy.splice(idx, 1);
        return copy;
      });
      // Adjust expandedIdx.
      setExpandedIdx((prev) => {
        if (prev === null) return null;
        if (prev === idx) return null; // collapsed the expanded row
        if (prev > idx) return prev - 1;
        return prev;
      });
    },
    [],
  );

  // Build a live view of workingList that includes current form state for the expanded row.
  const liveList = workingList.map((item, idx) => {
    if (idx !== expandedIdx) return item;
    const refTs =
      item.timestamp > 0
        ? item.timestamp
        : workingList.find((p) => p.timestamp > 0)?.timestamp ?? Date.now() / 1000;
    const parsed = parseTime(time, refTs);
    return {
      ...item,
      checkpoint,
      timestamp: parsed ?? item.timestamp,
      enabled: enabled ? 1 : 0,
    };
  });

  // Compute deltas from live list.
  const deltas = computeDeltas(liveList);

  // Find nearest enabled neighbors for expanded row (slider + delta).
  let prevEnabledTs: number | null = null;
  let nextEnabledTs: number | null = null;
  if (expandedIdx !== null) {
    for (let i = expandedIdx - 1; i >= 0; i--) {
      if (liveList[i].enabled === 1 && liveList[i].timestamp > 0) {
        prevEnabledTs = liveList[i].timestamp;
        break;
      }
    }
    for (let i = expandedIdx + 1; i < liveList.length; i++) {
      if (liveList[i].enabled === 1 && liveList[i].timestamp > 0) {
        nextEnabledTs = liveList[i].timestamp;
        break;
      }
    }
  }

  // Reference timestamp for parsing.
  const referenceTimestamp =
    expandedIdx !== null && workingList[expandedIdx]?.timestamp > 0
      ? workingList[expandedIdx].timestamp
      : (prevEnabledTs ?? nextEnabledTs ?? Date.now() / 1000);

  const parsedTimestamp = time ? parseTime(time, referenceTimestamp) : null;

  // Dynamic delta for expanded row.
  const timeInvalid = time !== "" && parsedTimestamp === null;
  const expandedDelta: number | "invalid" | null =
    prevEnabledTs !== null
      ? parsedTimestamp !== null
        ? parsedTimestamp - prevEnabledTs
        : timeInvalid
          ? "invalid"
          : null
      : null;

  // Save all changes.
  const handleSave = useCallback(async () => {
    // Flush current edit first.
    flushCurrentEdit();

    // We need to read the flushed state — use a ref-based approach via setState callback.
    setSaving(true);
    setError(null);

    // Build the latest list by flushing inline.
    const latestList = [...workingList];
    if (expandedIdx !== null) {
      const fallbackRefTs = latestList.find((p) => p.timestamp > 0)?.timestamp ?? Date.now() / 1000;
      latestList[expandedIdx] = applyFormToItem(latestList[expandedIdx], checkpoint, time, enabled, fallbackRefTs);
    }

    // Collect changes.
    const changes = latestList.filter((item) => item.isNew || item.isDirty);

    if (changes.length === 0) {
      onClose();
      return;
    }

    // Validate all changes.
    for (const item of changes) {
      if (!item.checkpoint.trim()) {
        setError(`Checkpoint name is required for all edited passings`);
        setSaving(false);
        return;
      }
      if (item.timestamp <= 0) {
        setError(`Valid time is required for "${item.checkpoint || "new passing"}"`);
        setSaving(false);
        return;
      }
    }

    try {
      const promises = changes.map((item) => {
        const payload = {
          card,
          checkpoint: item.checkpoint.trim(),
          timestamp: item.timestamp,
          enabled: item.enabled,
          source: "manual",
        };
        return item.isNew
          ? api.post(`/api/events/${eventId}/passings/manual`, payload)
          : api.put(`/api/events/${eventId}/passings/${item.id}`, payload);
      });
      await Promise.all(promises);
      pauseRefresh.request();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [flushCurrentEdit, workingList, expandedIdx, checkpoint, time, enabled, card, eventId, onClose]);

  // Colors for expanded row.
  const expandedBg = enabled
    ? theme.palette.primary.main
    : theme.palette.mode === "dark"
      ? theme.palette.grey[700]
      : theme.palette.grey[300];
  const expandedText = enabled
    ? theme.palette.primary.contrastText
    : theme.palette.text.secondary;

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { height: "75vh", display: "flex", flexDirection: "column" } }}
    >
      <DialogTitle sx={{ borderBottom: 1, borderColor: "divider", py: 1.5 }}>
        Edit mode
      </DialogTitle>
      <DialogContent
        onClick={(e) => { if (e.target === e.currentTarget) handleCollapse(); }}
        sx={{
          flex: 1,
          overflow: "auto",
          pt: "24px !important",
          pb: 3,
          px: 2,
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.default",
        }}
      >
        <Box sx={{ my: "auto", display: "flex", flexDirection: "column", gap: 0.5 }}>
        {/* Top insertion divider */}
        <InsertionDivider onClick={() => handleInsert(0)} />

        {workingList.map((item, idx) => (
          <Box key={item.id} onClick={(e) => { if (e.target === e.currentTarget) handleCollapse(); }}>
            {/* Expanded row */}
            {idx === expandedIdx ? (
              <Box ref={expandedRef} onClick={(e) => { if (e.target === e.currentTarget) handleCollapse(); }} sx={{ display: "flex", justifyContent: "center" }}>
                <Stack
                  sx={{
                    width: 210,
                    minHeight: 100,
                    px: 1.5,
                    py: 1,
                    borderRadius: 1,
                    bgcolor: expandedBg,
                    color: expandedText,
                    "@keyframes expandIn": {
                      from: { transform: "scale(0.52, 0.55)", opacity: 0 },
                      to: { transform: "scale(1)", opacity: 1 },
                    },
                    animation: "expandIn 0.25s ease-out",
                  }}
                >
                  {/* Checkpoint + enabled toggle */}
                  <Stack direction="row" sx={{ alignItems: "flex-start", width: "100%" }}>
                    <TextField
                      value={checkpoint}
                      onChange={(e) => setCheckpoint(e.target.value)}
                      placeholder="Checkpoint"
                      variant="outlined"
                      size="small"
                      disabled={saving}
                      autoFocus
                      sx={{
                        flex: 1,
                        maxWidth: 140,
                        "& .MuiOutlinedInput-root": {
                          color: expandedText,
                          fontWeight: 700,
                          fontSize: "1.225rem",
                          lineHeight: 1.2,
                          "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                          "&:hover fieldset": { borderColor: "rgba(255,255,255,0.5)" },
                          "&.Mui-focused fieldset": { borderColor: expandedText },
                        },
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => setEnabled((v) => !v)}
                      disabled={saving}
                      sx={{ color: expandedText, p: 0.25, flexShrink: 0, ml: "auto" }}
                    >
                      {enabled ? (
                        <CheckCircleIcon sx={{ fontSize: "2rem" }} />
                      ) : (
                        <CircleOutlinedIcon sx={{ fontSize: "2rem" }} />
                      )}
                    </IconButton>
                  </Stack>

                  {/* Time + slider */}
                  <Stack direction="row" sx={{ alignItems: "center", width: "100%", gap: 1, mt: 0.5 }}>
                    <TimeInput
                      value={time}
                      onChange={setTime}
                      variant="outlined"
                      size="small"
                      disabled={saving}
                      sx={{
                        maxWidth: 110,
                        "& .MuiOutlinedInput-root": {
                          color: expandedText,
                          fontFamily: "monospace",
                          fontSize: "0.648rem",
                          opacity: 0.9,
                          "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                          "&:hover fieldset": { borderColor: "rgba(255,255,255,0.5)" },
                          "&.Mui-focused fieldset": { borderColor: expandedText },
                        },
                      }}
                    />
                    {prevEnabledTs !== null && nextEnabledTs !== null && (
                      <Slider
                        size="small"
                        min={0}
                        max={100}
                        value={
                          parsedTimestamp !== null
                            ? Math.round(
                                ((parsedTimestamp - prevEnabledTs) /
                                  (nextEnabledTs - prevEnabledTs)) *
                                  100,
                              )
                            : 50
                        }
                        onChange={(_, val) => {
                          const t =
                            prevEnabledTs! +
                            ((val as number) / 100) * (nextEnabledTs! - prevEnabledTs!);
                          setTime(formatTime(t));
                        }}
                        disabled={saving}
                        valueLabelDisplay="auto"
                        sx={{
                          flex: 1,
                          color: expandedText,
                          "& .MuiSlider-thumb": { width: 12, height: 12 },
                        }}
                      />
                    )}
                  </Stack>

                  {/* Dynamic delta */}
                  {expandedDelta !== null && (
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "0.65rem",
                        lineHeight: 1,
                        opacity: 0.7,
                        mt: 0.5,
                        textAlign: "center",
                      }}
                    >
                      {expandedDelta === "invalid" ? "--:--.--" : formatDelta(expandedDelta)}
                    </Typography>
                  )}
                </Stack>
              </Box>
            ) : (
              /* Compact row */
              <CompactRow
                item={item}
                delta={deltas[idx]}
                onClick={() => handleSelect(idx)}
                onDelete={item.isNew ? () => handleDeleteNew(idx) : undefined}
                onEmptyClick={handleCollapse}
                shrinking={idx === shrinkingIdx}
              />
            )}

            {/* Insertion divider after each row */}
            <Box onClick={(e) => { if (e.target === e.currentTarget) handleCollapse(); }} sx={{ mt: 0.5 }}>
              <InsertionDivider onClick={() => handleInsert(idx + 1)} />
            </Box>
          </Box>
        ))}
        </Box>
      </DialogContent>

      {error && (
        <Typography color="error" variant="caption" sx={{ px: 3, pb: 1 }}>
          {error}
        </Typography>
      )}

      <DialogActions sx={{ px: 3, py: 1.5, borderTop: 1, borderColor: "divider" }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
