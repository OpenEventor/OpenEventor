import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import OutlinedInput from "@mui/material/OutlinedInput";
import FilledInput from "@mui/material/FilledInput";
import FormHelperText from "@mui/material/FormHelperText";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import TodayIcon from "@mui/icons-material/Today";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import type { SxProps, Theme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { type Dayjs } from "dayjs";
import {
  pad,
  toTimestamp,
  fromTimestamp,
  dateDiffDays,
  addDays,
  clampValue,
  normalizeSections,
} from "./utils";

// Re-export for consumers that import directly from TimeInput
export { toTimestamp, fromTimestamp };

// ── Constants ────────────────────────────────────────────────────────

/** Vertical pixels of mouse movement per one increment step during scrub. */
const DRAG_PIXELS_PER_STEP = 5;

/** Configuration for the four time sections: HH:mm:ss.cs */
const SECTIONS = [
  { key: "hours", min: 0, max: 23, placeholder: "HH", label: "Hours" },
  { key: "minutes", min: 0, max: 59, placeholder: "mm", label: "Minutes" },
  { key: "seconds", min: 0, max: 59, placeholder: "ss", label: "Seconds" },
  { key: "centiseconds", min: 0, max: 99, placeholder: "00", label: "Centiseconds" },
] as const;

const SEPARATORS = [":", ":", "."];
const EMPTY_SECTIONS = ["", "", "", ""];

/** Configuration for the day segment (0d–99d). */
const DAY_CONFIG = { min: 0, max: 99, placeholder: "0", label: "Days" };

/** Build a timestamp from section strings + date string + timezone. */
function sectionsToTimestamp(
  secs: string[],
  dateStr: string,
  timezone: string,
): number | null {
  const allEmpty = secs.every((s) => s === "");
  if (allEmpty) return null;
  const normalized = normalizeSections(secs, SECTIONS);
  const [h, m, s, cs] = normalized.map((v) => parseInt(v, 10));
  return toTimestamp(dateStr, h, m, s, cs, timezone);
}

// ── Types ────────────────────────────────────────────────────────────

export interface TimeInputProps {
  /** Unix timestamp (seconds with centisecond precision), or null. */
  value: number | null;
  /** Event date in YYYY-MM-DD format. Always from useEvent().date. */
  baseDate: string;
  /** IANA timezone string. From useEvent().timezone. */
  timezone: string;
  /** Show calendar icon to pick a different date (multi-day events). */
  allowChangeDate?: boolean;
  /** Fires on every edit (scrub, arrow, typing) for real-time updates. */
  onChange: (value: number | null) => void;
  size?: "small" | "medium";
  variant?: "outlined" | "filled";
  label?: React.ReactNode;
  disabled?: boolean;
  error?: boolean;
  helperText?: React.ReactNode;
  fullWidth?: boolean;
  sx?: SxProps<Theme>;
}

// ── SectionInput ────────────────────────────────────────────────────
// A single editable segment (hours, minutes, seconds, centiseconds, or days).
// Supports: keyboard typing, arrow keys ±1, vertical scrub (drag).

interface SectionInputProps {
  value: string;
  config: { min: number; max: number; placeholder: string; label: string };
  disabled: boolean;
  /** Whether the parent TimeInput is focused (affects cursor style). */
  active: boolean;
  size: "small" | "medium";
  onValueChange: (value: string) => void;
  onIncrement: (delta: number) => void;
  onCommit: () => void;
  onFocusSelf: () => void;
  onFocusNext?: () => void;
  onFocusPrev?: () => void;
  onBlurSection: (e: React.FocusEvent) => void;
  inputRef: (el: HTMLInputElement | null) => void;
  /** Text suffix displayed after the input (e.g. "d" for day segment). */
  suffix?: string;
  /** CSS width of the input element. Default "2ch". */
  width?: string;
  /** Format a numeric value for display. Default: pad to 2 digits. */
  formatValue?: (n: number) => string;
  /** Called when a scrub (drag) ends — used for day segment hide logic. */
  onDragEnd?: () => void;
}

function SectionInput({
  value,
  config,
  disabled,
  active,
  size,
  onValueChange,
  onIncrement,
  onCommit,
  onFocusSelf,
  onFocusNext,
  onFocusPrev,
  onBlurSection,
  inputRef,
  suffix,
  width = "2ch",
  formatValue = pad,
  onDragEnd,
}: SectionInputProps) {
  const localRef = useRef<HTMLInputElement | null>(null);
  // Guard: prevents rAF-based select() from interfering with ongoing typing.
  const selectAllowed = useRef(true);
  // Tracks active drag state for scrub gesture.
  const dragState = useRef<{
    startY: number;
    startValue: number;
    dragging: boolean;
  } | null>(null);

  const setRef = useCallback(
    (el: HTMLInputElement | null) => {
      localRef.current = el;
      inputRef(el);
    },
    [inputRef],
  );

  // ── Scrub (vertical drag) ────────────────────────────────────────
  // mouseDown always calls preventDefault to block native text drag-and-drop.
  // If the user drags > 3px vertically, it becomes a scrub gesture.
  // Otherwise, it's treated as a click (focus + select all).

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;

      // Block native text drag-and-drop in all cases
      e.preventDefault();

      const currentValue = value === "" ? 0 : parseInt(value, 10);

      dragState.current = {
        startY: e.clientY,
        startValue: isNaN(currentValue) ? 0 : currentValue,
        dragging: false,
      };

      const handleMouseMove = (moveE: MouseEvent) => {
        if (!dragState.current) return;
        const deltaY = dragState.current.startY - moveE.clientY;

        // Activate scrub mode after 3px threshold
        if (!dragState.current.dragging && Math.abs(deltaY) > 3) {
          dragState.current.dragging = true;
          document.body.style.userSelect = "none";
          document.body.style.cursor = "ns-resize";
        }

        if (dragState.current.dragging) {
          const steps = Math.round(deltaY / DRAG_PIXELS_PER_STEP);
          const newVal = clampValue(
            dragState.current.startValue,
            steps,
            config.min,
            config.max,
          );
          onValueChange(formatValue(newVal));
        }
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";

        if (dragState.current?.dragging) {
          // After a drag, swallow the upcoming click event (capture phase)
          // to prevent parent handlers (e.g. PassingsEditor collapse) from firing.
          const stopClick = (ce: Event) => {
            ce.stopPropagation();
            document.removeEventListener("click", stopClick, true);
          };
          document.addEventListener("click", stopClick, true);
          onDragEnd?.();
        } else {
          // Click without drag — focus the input and select all text
          const input = localRef.current;
          if (input) {
            selectAllowed.current = true;
            input.focus();
            requestAnimationFrame(() => {
              if (selectAllowed.current) input.select();
            });
          }
        }
        dragState.current = null;
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [disabled, value, config, onValueChange, formatValue, onDragEnd],
  );

  // ── Keyboard typing ──────────────────────────────────────────────
  // Strips non-digits, limits to 2 chars. Auto-advances to next section
  // when 2 digits are typed.

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      selectAllowed.current = false;
      const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
      onValueChange(raw);

      if (raw.length === 2 && onFocusNext) {
        onFocusNext();
      }
    },
    [onValueChange, onFocusNext],
  );

  // ── Arrow keys / Tab / Enter ─────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onIncrement(1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        onIncrement(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onFocusNext?.();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onFocusPrev?.();
      } else if (e.key === "Tab") {
        // Let Tab navigate between sections; fall through to browser default
        // when there's no next/prev section to move to.
        if (!e.shiftKey && onFocusNext) {
          e.preventDefault();
          onFocusNext();
        } else if (e.shiftKey && onFocusPrev) {
          e.preventDefault();
          onFocusPrev();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        onCommit();
      }
    },
    [onIncrement, onFocusNext, onFocusPrev, onCommit],
  );

  const handleFocus = useCallback(() => {
    onFocusSelf();
    requestAnimationFrame(() => {
      if (selectAllowed.current) localRef.current?.select();
    });
  }, [onFocusSelf]);

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "baseline",
        "& input::placeholder": { color: "inherit", opacity: 0.4 },
      }}
    >
      <input
        ref={setRef}
        value={value}
        placeholder={config.placeholder}
        disabled={disabled}
        inputMode="numeric"
        aria-label={config.label}
        onMouseDown={handleMouseDown}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={onBlurSection}
        style={{
          border: "none",
          outline: "none",
          background: "transparent",
          width,
          textAlign: "center",
          font: "inherit",
          color: "inherit",
          padding: 0,
          cursor: disabled ? "default" : active ? "ns-resize" : "text",
          fontSize: size === "small" ? "0.875rem" : "1rem",
        }}
      />
      {suffix && (
        <span
          style={{
            font: "inherit",
            color: "inherit",
            opacity: 0.5,
            userSelect: "none",
            fontSize: size === "small" ? "0.875rem" : "1rem",
          }}
        >
          {suffix}
        </span>
      )}
    </Box>
  );
}

// ── DateSettingsModal ────────────────────────────────────────────────
// Popup dialog for picking a different date (multi-day events).

interface DateModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (date: string) => void;
  initialDate: string;
  minDate: string;
}

function DateSettingsModal({
  open,
  onClose,
  onApply,
  initialDate,
  minDate,
}: DateModalProps) {
  const [date, setDate] = useState(initialDate);

  useEffect(() => {
    if (open) {
      setDate(initialDate);
    }
  }, [open, initialDate]);

  const handleDateChange = useCallback((val: Dayjs | null) => {
    if (val && val.isValid()) {
      setDate(val.format("YYYY-MM-DD"));
    }
  }, []);

  const handleApply = useCallback(() => {
    onApply(date);
  }, [date, onApply]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog open={open} onClose={onClose} maxWidth="xs">
        <DialogTitle sx={{ textAlign: "center" }}>Change Date</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <DatePicker
              label=""
              value={date ? dayjs(date, "YYYY-MM-DD") : null}
              onChange={handleDateChange}
              format="DD.MM.YYYY"
              minDate={dayjs(minDate, "YYYY-MM-DD")}
              slotProps={{
                textField: { size: "small", fullWidth: true },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
          <Button onClick={handleApply} variant="contained">
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
}

// ── Main Component ───────────────────────────────────────────────────
// TimeInput renders HH:mm:ss.cs with an optional Xd day prefix.
//
// Architecture:
// - `value` prop → `parsed` (useMemo) → `derivedSections` / `derivedDays` for display
// - On edit: `localSections` / `localDays` state overrides derived values
// - `fireChange()` reads local refs and calls onChange immediately on every edit
// - On blur (leaving the component): `commit()` normalizes, fires final onChange,
//   clears local state — display reverts to value prop via derived values
//
// Day segment visibility:
// - Shown when derivedDays > 0 (value is on a day after baseDate) or localDays is set
// - Scrub to 0d → hide immediately via `hideDaySegment()`
// - Arrow/keyboard to 0d → hide after 1 second via `scheduleDayHide()`
// - `dayJustHidden` ref suppresses visibility until value prop catches up

export default function TimeInput({
  value,
  baseDate,
  timezone,
  allowChangeDate = false,
  onChange,
  size = "medium",
  variant = "outlined",
  label,
  disabled = false,
  error = false,
  helperText,
  fullWidth = false,
  sx,
}: TimeInputProps) {
  // ── Local editing state ───────────────────────────────────────────
  // null = not editing (display from value prop).
  // string[] = user is actively editing sections.
  const [localSections, setLocalSections] = useState<string[] | null>(null);
  const localRef = useRef<string[] | null>(null);
  localRef.current = localSections;

  const [focused, setFocused] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Refs to individual <input> elements for focus management.
  const sectionRefs = useRef<(HTMLInputElement | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ── Derive display values from the value prop ─────────────────────

  const parsed = useMemo(() => {
    if (value === null || value === undefined) return null;
    if (typeof value !== "number" || !isFinite(value) || value <= 0)
      return null;
    return fromTimestamp(value, timezone);
  }, [value, timezone]);

  const derivedDate = parsed?.date ?? baseDate;
  const derivedDateRef = useRef(derivedDate);
  derivedDateRef.current = derivedDate;

  const derivedSections = useMemo<string[]>(() => {
    if (!parsed) return EMPTY_SECTIONS;
    return [
      pad(parsed.hours),
      pad(parsed.minutes),
      pad(parsed.seconds),
      pad(parsed.centiseconds),
    ];
  }, [parsed]);

  const derivedSectionsRef = useRef(derivedSections);
  derivedSectionsRef.current = derivedSections;

  // Stable ref for onChange to avoid re-creating callbacks.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // ── Day segment state ───────────────────────────────────────────────

  const dayInputRef = useRef<HTMLInputElement | null>(null);
  const [localDays, setLocalDays] = useState<string | null>(null);
  const localDaysRef = useRef<string | null>(null);
  localDaysRef.current = localDays;

  /** How many days after baseDate the current value falls on. */
  const derivedDays = useMemo(() => {
    if (!parsed) return 0;
    return dateDiffDays(baseDate, parsed.date);
  }, [parsed, baseDate]);

  // Suppresses day segment visibility after hiding it via scrub/keyboard,
  // until the value prop catches up (derivedDays becomes 0).
  const dayJustHidden = useRef(false);

  const daySegmentVisible = !dayJustHidden.current && (derivedDays > 0 || localDays !== null);

  const getDayValue = useCallback(() => {
    if (localDays !== null) return localDays;
    return derivedDays > 0 ? String(derivedDays) : "";
  }, [localDays, derivedDays]);

  /** Get display value for a time section (local override or derived). */
  const getSectionValue = useCallback(
    (index: number) => {
      if (localSections !== null) return localSections[index];
      return derivedSections[index];
    },
    [localSections, derivedSections],
  );

  // ── Enter editing mode ────────────────────────────────────────────
  // Initializes local sections from derived values if not already editing.

  function ensureEditing(): string[] {
    let secs = localRef.current;
    if (secs === null) {
      secs = [...derivedSectionsRef.current];
      setLocalSections(secs);
      localRef.current = secs;
    }
    return secs;
  }

  // ── Immediate onChange — fires on every edit ─────────────────────
  // Reads current local state (refs) and computes a timestamp.
  // Clamps to ensure timestamp >= baseDate 00:00:00.00.

  const fireChange = useCallback(() => {
    const secs = localRef.current;
    if (secs === null) return;
    const allEmpty = secs.every((s) => s === "");
    const days = localDaysRef.current;
    const dayCount = days !== null ? (parseInt(days, 10) || 0) : derivedDays;
    if (allEmpty && dayCount === 0) {
      onChangeRef.current(null);
      return;
    }
    const normalized = normalizeSections(secs, SECTIONS);
    const targetDate = dayCount > 0 ? addDays(baseDate, dayCount) : baseDate;
    const [h, m, s, cs] = normalized.map((v) => parseInt(v, 10));
    let ts = toTimestamp(targetDate, h, m, s, cs, timezone);
    // Clamp: don't allow times before the event start
    const minTs = toTimestamp(baseDate, 0, 0, 0, 0, timezone);
    if (ts < minTs) ts = minTs;
    onChangeRef.current(ts);
  }, [timezone, baseDate, derivedDays]);

  // ── Time section handlers ──────────────────────────────────────────

  const handleValueChange = useCallback((index: number, val: string) => {
    const secs = ensureEditing();
    const next = [...secs];
    next[index] = val;
    setLocalSections(next);
    localRef.current = next;
    fireChange();
  }, [fireChange]);

  const handleIncrement = useCallback((index: number, delta: number) => {
    const secs = ensureEditing();
    const current = secs[index];
    const config = SECTIONS[index];
    const n = current === "" ? 0 : parseInt(current, 10);
    const newVal = pad(
      clampValue(isNaN(n) ? 0 : n, delta, config.min, config.max),
    );
    const next = [...secs];
    next[index] = newVal;
    setLocalSections(next);
    localRef.current = next;
    fireChange();
  }, [fireChange]);

  const handleFocusSection = useCallback((index: number) => {
    ensureEditing();
    if (index >= 0 && index < SECTIONS.length) {
      const input = sectionRefs.current[index];
      if (input) {
        input.focus();
        requestAnimationFrame(() => input.select());
      }
    }
    setFocused(true);
  }, []);

  // ── Day segment handlers ───────────────────────────────────────────

  const dayHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelDayHide = useCallback(() => {
    if (dayHideTimer.current) {
      clearTimeout(dayHideTimer.current);
      dayHideTimer.current = null;
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => () => { if (dayHideTimer.current) clearTimeout(dayHideTimer.current); }, []);

  const handleDayValueChange = useCallback((val: string) => {
    ensureEditing();
    const raw = val.replace(/\D/g, "").slice(0, 2);
    setLocalDays(raw);
    localDaysRef.current = raw;
    fireChange();
  }, [fireChange]);

  const handleDayIncrement = useCallback((delta: number) => {
    ensureEditing();
    const current = localDaysRef.current !== null
      ? parseInt(localDaysRef.current, 10)
      : derivedDays;
    const n = isNaN(current) ? 0 : current;
    const newVal = clampValue(n, delta, DAY_CONFIG.min, DAY_CONFIG.max);
    const str = String(newVal);
    setLocalDays(str);
    localDaysRef.current = str;
    fireChange();
  }, [derivedDays, fireChange]);

  const handleFocusDaySection = useCallback(() => {
    ensureEditing();
    if (localDaysRef.current === null) {
      const dayStr = derivedDays > 0 ? String(derivedDays) : "0";
      setLocalDays(dayStr);
      localDaysRef.current = dayStr;
    }
    setFocused(true);
  }, [derivedDays]);

  const focusDayInput = useCallback(() => {
    if (dayInputRef.current) {
      dayInputRef.current.focus();
      requestAnimationFrame(() => dayInputRef.current?.select());
    }
  }, []);

  // ── Commit — normalize, fire final onChange, clear editing state ───

  const commit = useCallback(() => {
    const secs = localRef.current;
    const days = localDaysRef.current;

    // Nothing edited — nothing to commit
    if (secs === null && days === null) return;

    // Fire final normalized onChange
    fireChange();

    // Clear editing state — display reverts to value prop via derivedSections
    setLocalSections(null);
    localRef.current = null;
    setLocalDays(null);
    localDaysRef.current = null;
  }, [fireChange]);

  // Reset dayJustHidden when value prop updates — derivedDays is now accurate.
  useEffect(() => {
    dayJustHidden.current = false;
  }, [value]);

  // ── Day hide logic ────────────────────────────────────────────────
  // When day count reaches 0:
  // - Via scrub (drag): hide immediately (handleDayDragEnd)
  // - Via keyboard/typing: hide after 1 second delay (scheduleDayHide)

  /** Hide the day segment immediately: fire onChange with 0 days, suppress visibility, move focus. */
  const hideDaySegment = useCallback(() => {
    localDaysRef.current = "0";
    setLocalDays("0");
    fireChange();
    // Suppress segment visibility until value prop catches up
    dayJustHidden.current = true;
    setLocalDays(null);
    localDaysRef.current = null;
    // Move focus to first time section
    const input = sectionRefs.current[0];
    if (input) {
      input.focus();
      requestAnimationFrame(() => input.select());
    }
  }, [fireChange]);

  /** Schedule hiding the day segment after 1 second (cancellable). */
  const scheduleDayHide = useCallback(() => {
    if (dayHideTimer.current) clearTimeout(dayHideTimer.current);
    dayHideTimer.current = setTimeout(() => {
      dayHideTimer.current = null;
      hideDaySegment();
    }, 1000);
  }, [hideDaySegment]);

  /** Called when scrub ends on the day segment — hide immediately if 0. */
  const handleDayDragEnd = useCallback(() => {
    const val = parseInt(localDaysRef.current ?? "", 10);
    if (val === 0 || isNaN(val)) {
      cancelDayHide();
      hideDaySegment();
    }
  }, [cancelDayHide, hideDaySegment]);

  // Wrappers that add day-hide scheduling to value change and increment.
  const handleDayValueChangeWithHide = useCallback((val: string) => {
    handleDayValueChange(val);
    const n = parseInt(val.replace(/\D/g, ""), 10);
    if (n === 0 || (val === "" && derivedDays === 0)) {
      scheduleDayHide();
    } else {
      cancelDayHide();
    }
  }, [handleDayValueChange, derivedDays, scheduleDayHide, cancelDayHide]);

  const handleDayIncrementWithHide = useCallback((delta: number) => {
    handleDayIncrement(delta);
    const val = parseInt(localDaysRef.current ?? "", 10);
    if (val === 0 || isNaN(val)) {
      scheduleDayHide();
    } else {
      cancelDayHide();
    }
  }, [handleDayIncrement, scheduleDayHide, cancelDayHide]);

  // ── Blur detection ────────────────────────────────────────────────
  // When focus leaves the entire TimeInput (not just moving between sections),
  // commit the current edit.

  const handleBlurSection = useCallback(
    (e: React.FocusEvent) => {
      const container = containerRef.current;
      if (
        container &&
        e.relatedTarget &&
        container.contains(e.relatedTarget as Node)
      ) {
        // Moving between sections within the same TimeInput — keep editing
        return;
      }
      // Focus left the component entirely — commit and exit editing
      setFocused(false);
      commit();
    },
    [commit],
  );

  // ── Modal handlers ────────────────────────────────────────────────

  const handleModalOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setModalOpen(true);
  }, []);

  const handleModalApply = useCallback(
    (dateStr: string) => {
      const finalDate = dateStr || baseDate;
      const secs = localRef.current || derivedSectionsRef.current;
      let ts = sectionsToTimestamp(secs, finalDate, timezone);

      // Clamp: timestamp must not be earlier than baseDate 00:00:00.00
      if (ts !== null) {
        const minTs = toTimestamp(baseDate, 0, 0, 0, 0, timezone);
        if (ts < minTs) ts = minTs;
      }

      onChangeRef.current(ts);

      // Show day segment immediately (don't wait for value prop round-trip)
      const days = ts !== null ? dateDiffDays(baseDate, finalDate) : 0;
      if (days > 0) {
        setLocalDays(String(days));
        localDaysRef.current = String(days);
      } else {
        setLocalDays(null);
        localDaysRef.current = null;
      }
      setLocalSections(null);
      localRef.current = null;
      setModalOpen(false);
    },
    [baseDate, timezone],
  );

  // ── Click on container focuses first section ──────────────────────

  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      if (!(e.target instanceof HTMLInputElement)) {
        sectionRefs.current[0]?.focus();
      }
    },
    [disabled],
  );

  // ── Render ────────────────────────────────────────────────────────

  return (
    <>
      <FormControl
        variant={variant}
        size={size}
        error={error}
        disabled={disabled}
        fullWidth={fullWidth}
        focused={focused}
        sx={sx}
      >
        {label && <InputLabel shrink>{label}</InputLabel>}
        {(() => {
          const startAdornment = (
            <InputAdornment
              position="start"
              sx={{ mr: 0, ml: 0, color: "inherit" }}
            >
              <Box
                ref={containerRef}
                role="group"
                aria-label="Time input"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  fontFamily: "monospace",
                  lineHeight: 1,
                  color: "inherit",
                }}
              >
                {/* Day segment (Xd) — visible when value > baseDate or during editing */}
                {daySegmentVisible && (
                  <Box sx={{ display: "flex", alignItems: "center", mr: "3px" }}>
                    <SectionInput
                      value={getDayValue()}
                      config={DAY_CONFIG}
                      disabled={disabled}
                      active={focused}
                      size={size}
                      onValueChange={handleDayValueChangeWithHide}
                      onIncrement={handleDayIncrementWithHide}
                      onCommit={commit}
                      onFocusSelf={handleFocusDaySection}
                      formatValue={String}
                      onFocusNext={() => handleFocusSection(0)}
                      onBlurSection={handleBlurSection}
                      onDragEnd={handleDayDragEnd}
                      inputRef={(el) => { dayInputRef.current = el; }}
                      suffix="d"
                    />
                  </Box>
                )}
                {/* Time sections: HH : mm : ss . cs */}
                {SECTIONS.map((config, i) => (
                  <Box
                    key={config.key}
                    sx={{ display: "flex", alignItems: "center" }}
                  >
                    {i > 0 && (
                      <Box
                        component="span"
                        aria-hidden="true"
                        sx={{
                          opacity: 0.5,
                          userSelect: "none",
                          px: "1px",
                          fontSize: size === "small" ? "0.875rem" : "1rem",
                        }}
                      >
                        {SEPARATORS[i - 1]}
                      </Box>
                    )}
                    <SectionInput
                      value={getSectionValue(i)}
                      config={config}
                      disabled={disabled}
                      active={focused}
                      size={size}
                      onValueChange={(val) => handleValueChange(i, val)}
                      onIncrement={(delta) => handleIncrement(i, delta)}
                      onCommit={commit}
                      onFocusSelf={() => handleFocusSection(i)}
                      onFocusNext={i < SECTIONS.length - 1 ? () => handleFocusSection(i + 1) : undefined}
                      onFocusPrev={i > 0 ? () => handleFocusSection(i - 1) : (daySegmentVisible ? focusDayInput : undefined)}
                      onBlurSection={handleBlurSection}
                      inputRef={(el) => {
                        sectionRefs.current[i] = el;
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </InputAdornment>
          );

          const endAdornment = allowChangeDate ? (
            <InputAdornment
              position="end"
              sx={{
                ml: "auto",
                color: "inherit",
                opacity: 0,
                transition: "opacity 0.15s",
                ".MuiInputBase-root:hover &": { opacity: 1 },
              }}
            >
              <IconButton
                size="small"
                onClick={handleModalOpen}
                disabled={disabled}
                edge="end"
                aria-label="Change date"
                sx={{ color: "inherit" }}
              >
                <TodayIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined;

          // Hidden native input — MUI requires an <input> inside Input components.
          // We use our custom SectionInput elements instead.
          const inputSlotProps = {
            input: {
              style: {
                width: 0,
                padding: 0,
                border: "none",
                overflow: "hidden",
                opacity: 0,
                position: "absolute",
                pointerEvents: "none",
              } as React.CSSProperties,
              tabIndex: -1,
              "aria-hidden": true,
            },
          };

          const inputSx = {
            cursor: "default",
            ...(variant === "outlined" && {
              minHeight: size === "small" ? 40 : 56,
            }),
            ...(variant === "filled" && {
              // Tuned padding to match standard MUI FilledInput height
              pt: size === "small" ? "5px" : "9px",
              pb: size === "small" ? "4px" : "8px",
            }),
          };

          if (variant === "filled") {
            return (
              <FilledInput
                readOnly
                onClick={handleContainerClick}
                startAdornment={startAdornment}
                endAdornment={endAdornment}
                slotProps={inputSlotProps}
                sx={inputSx}
              />
            );
          }
          return (
            <OutlinedInput
              notched={!!label}
              label={label}
              readOnly
              onClick={handleContainerClick}
              startAdornment={startAdornment}
              endAdornment={endAdornment}
              slotProps={inputSlotProps}
              sx={inputSx}
            />
          );
        })()}
        {helperText && <FormHelperText>{helperText}</FormHelperText>}
      </FormControl>

      {allowChangeDate && (
        <DateSettingsModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onApply={handleModalApply}
          initialDate={derivedDate}
          minDate={baseDate}
        />
      )}
    </>
  );
}
