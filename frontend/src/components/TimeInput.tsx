import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  forwardRef,
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

// ── Constants ────────────────────────────────────────────────────────

const DRAG_PIXELS_PER_STEP = 5;

const SECTIONS = [
  { key: "hours", min: 0, max: 23, placeholder: "HH" },
  { key: "minutes", min: 0, max: 59, placeholder: "mm" },
  { key: "seconds", min: 0, max: 59, placeholder: "ss" },
  { key: "centiseconds", min: 0, max: 99, placeholder: "00" },
] as const;

const SEPARATORS = [":", ":", "."];
const EMPTY_SECTIONS = ["", "", "", ""];

// ── Timezone helpers ─────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = date.toLocaleString("en-US", { timeZone: timezone });
  return new Date(utcStr).getTime() - new Date(tzStr).getTime();
}

export function toTimestamp(
  dateStr: string,
  h: number,
  m: number,
  s: number,
  cs: number,
  timezone: string,
): number {
  const isoStr = `${dateStr}T${pad(h)}:${pad(m)}:${pad(s)}Z`;
  const asUtc = new Date(isoStr);
  const offsetMs = getTimezoneOffsetMs(asUtc, timezone);
  return (asUtc.getTime() + offsetMs) / 1000 + cs / 100;
}

export function fromTimestamp(
  timestamp: number,
  timezone: string,
): {
  date: string;
  hours: number;
  minutes: number;
  seconds: number;
  centiseconds: number;
} {
  const wholeSeconds = Math.floor(timestamp);
  const cs = Math.round((timestamp - wholeSeconds) * 100);
  const date = new Date(wholeSeconds * 1000);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hours: parseInt(get("hour"), 10),
    minutes: parseInt(get("minute"), 10),
    seconds: parseInt(get("second"), 10),
    centiseconds: cs,
  };
}

// ── Wrap value with cycling ──────────────────────────────────────────

function clampValue(current: number, delta: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, current + delta));
}

/** Normalize raw section strings: pad, clamp, empty→"00". */
function normalizeSections(secs: string[]): string[] {
  return secs.map((s, i) => {
    if (s === "") return "00";
    const n = parseInt(s, 10);
    const config = SECTIONS[i];
    return pad(Math.min(Math.max(isNaN(n) ? 0 : n, config.min), config.max));
  });
}

/** Build a timestamp from section strings + date. */
function sectionsToTimestamp(
  secs: string[],
  dateStr: string,
  timezone: string,
): number | null {
  const allEmpty = secs.every((s) => s === "");
  if (allEmpty) return null;
  const normalized = normalizeSections(secs);
  const [h, m, s, cs] = normalized.map((v) => parseInt(v, 10));
  return toTimestamp(dateStr, h, m, s, cs, timezone);
}

// ── Types ────────────────────────────────────────────────────────────

export interface TimeInputProps {
  value: number | null;
  baseDate: string;
  timezone: string;
  allowChangeDate?: boolean;
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

// ── Section Input ────────────────────────────────────────────────────

interface SectionInputProps {
  index: number;
  value: string;
  config: (typeof SECTIONS)[number];
  disabled: boolean;
  active: boolean;
  size: "small" | "medium";
  onValueChange: (index: number, value: string) => void;
  onIncrement: (index: number, delta: number) => void;
  onCommit: () => void;
  onFocusSection: (index: number) => void;
  onBlurSection: (e: React.FocusEvent) => void;
  inputRef: (el: HTMLInputElement | null) => void;
}

const SectionInput = forwardRef<HTMLInputElement, SectionInputProps>(
  function SectionInput(
    {
      index,
      value,
      config,
      disabled,
      active,
      size,
      onValueChange,
      onIncrement,
      onCommit,
      onFocusSection,
      onBlurSection,
      inputRef,
    },
    _ref,
  ) {
    const localRef = useRef<HTMLInputElement | null>(null);
    const selectAllowed = useRef(true);
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

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (disabled) return;

        if (!active) {
          const input = localRef.current;
          if (input) {
            selectAllowed.current = true;
            input.focus();
            requestAnimationFrame(() => {
              if (selectAllowed.current) input.select();
            });
          }
          return;
        }

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
            onValueChange(index, pad(newVal));
          }
        };

        const handleMouseUp = () => {
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
          document.body.style.userSelect = "";
          document.body.style.cursor = "";

          if (!dragState.current?.dragging) {
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
      [disabled, active, value, config, index, onValueChange],
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        selectAllowed.current = false;
        const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
        onValueChange(index, raw);

        if (raw.length === 2) {
          onFocusSection(index + 1);
        }
      },
      [index, onValueChange, onFocusSection],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          onIncrement(index, 1);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          onIncrement(index, -1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          if (index < SECTIONS.length - 1) onFocusSection(index + 1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          if (index > 0) onFocusSection(index - 1);
        } else if (e.key === "Tab") {
          if (!e.shiftKey && index < SECTIONS.length - 1) {
            e.preventDefault();
            onFocusSection(index + 1);
          } else if (e.shiftKey && index > 0) {
            e.preventDefault();
            onFocusSection(index - 1);
          }
        } else if (e.key === "Enter") {
          e.preventDefault();
          onCommit();
        }
      },
      [index, onIncrement, onFocusSection, onCommit],
    );

    const handleFocus = useCallback(() => {
      onFocusSection(index);
      requestAnimationFrame(() => {
        if (selectAllowed.current) localRef.current?.select();
      });
    }, [index, onFocusSection]);

    return (
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          "& input::placeholder": { color: "inherit", opacity: 0.4 },
        }}
      >
        <input
          ref={setRef}
          value={value}
          placeholder={config.placeholder}
          disabled={disabled}
          inputMode="numeric"
          onMouseDown={handleMouseDown}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={onBlurSection}
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            width: "2ch",
            textAlign: "center",
            font: "inherit",
            color: "inherit",
            padding: 0,
            cursor: disabled ? "default" : active ? "ns-resize" : "text",
            fontSize: size === "small" ? "0.875rem" : "1rem",
          }}
        />
      </Box>
    );
  },
);

// ── Date Settings Modal ──────────────────────────────────────────────

interface DateModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (date: string) => void;
  initialDate: string;
}

function DateSettingsModal({
  open,
  onClose,
  onApply,
  initialDate,
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
  // string[] = editing locally (onChange fires only on commit).
  const [localSections, setLocalSections] = useState<string[] | null>(null);
  const localRef = useRef<string[] | null>(null);
  localRef.current = localSections;

  const [focused, setFocused] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const sectionRefs = useRef<(HTMLInputElement | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ── Derive display sections from value prop ─────────────────────────

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

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Track last committed value so we know when value prop has caught up
  const committedValueRef = useRef<number | null | undefined>(undefined);

  /** Get display value for a section. */
  const getSectionValue = useCallback(
    (index: number) => {
      if (localSections !== null) return localSections[index];
      return derivedSections[index];
    },
    [localSections, derivedSections],
  );

  // ── Enter editing mode ────────────────────────────────────────────

  function ensureEditing(): string[] {
    let secs = localRef.current;
    if (secs === null) {
      secs = [...derivedSectionsRef.current];
      setLocalSections(secs);
      localRef.current = secs;
    }
    return secs;
  }

  // ── Section handlers (update local state only, no onChange) ────────

  const handleValueChange = useCallback((index: number, val: string) => {
    const secs = ensureEditing();
    const next = [...secs];
    next[index] = val;
    setLocalSections(next);
    localRef.current = next;
  }, []);

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
  }, []);

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

  // ── Commit — normalize, fire onChange, exit editing ────────────────

  const commit = useCallback(() => {
    const secs = localRef.current;
    if (secs === null) return;

    const allEmpty = secs.every((s) => s === "");
    if (allEmpty) {
      committedValueRef.current = null;
      onChangeRef.current(null);
      setLocalSections(null);
      localRef.current = null;
    } else {
      const normalized = normalizeSections(secs);
      const dateStr = derivedDateRef.current;
      const ts = sectionsToTimestamp(normalized, dateStr, timezone);
      committedValueRef.current = ts;
      onChangeRef.current(ts);
      // Keep normalized sections visible until value prop catches up
      setLocalSections(normalized);
      localRef.current = normalized;
    }
  }, [timezone]);

  // Clear local editing state once value prop confirms our commit.
  // Only clear when parsed is non-null — this means the value prop has
  // actually propagated from react-hook-form and derivedSections will
  // correctly display the committed value.
  useEffect(() => {
    if (committedValueRef.current !== undefined && localRef.current !== null) {
      if (parsed !== null) {
        committedValueRef.current = undefined;
        setLocalSections(null);
        localRef.current = null;
      }
    }
  }, [value, parsed]);

  // ── Blur detection ────────────────────────────────────────────────

  const handleBlurSection = useCallback(
    (e: React.FocusEvent) => {
      const container = containerRef.current;
      if (
        container &&
        e.relatedTarget &&
        container.contains(e.relatedTarget as Node)
      ) {
        // Moving between sections — do nothing, localSections persists.
        return;
      }
      // Left the component — commit and exit editing.
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
      onChangeRef.current(sectionsToTimestamp(secs, finalDate, timezone));
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
                sx={{
                  display: "flex",
                  alignItems: "center",
                  fontFamily: "monospace",
                  lineHeight: 1,
                  color: "inherit",
                }}
              >
                {SECTIONS.map((config, i) => (
                  <Box
                    key={config.key}
                    sx={{ display: "flex", alignItems: "center" }}
                  >
                    {i > 0 && (
                      <Box
                        component="span"
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
                      index={i}
                      value={getSectionValue(i)}
                      config={config}
                      disabled={disabled}
                      active={focused}
                      size={size}
                      onValueChange={handleValueChange}
                      onIncrement={handleIncrement}
                      onCommit={commit}
                      onFocusSection={handleFocusSection}
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
                sx={{ color: "inherit" }}
              >
                <TodayIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined;
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
              },
              tabIndex: -1,
              "aria-hidden": true,
            } as React.InputHTMLAttributes<HTMLInputElement>,
          };
          const inputSx = {
            cursor: "default",
            ...(variant === "outlined" && {
              minHeight: size === "small" ? 40 : 56,
            }),
            ...(variant === "filled" && {
              // Match standard MUI FilledInput padding so height equals a regular TextField
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
        />
      )}
    </>
  );
}
