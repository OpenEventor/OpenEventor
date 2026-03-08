import { useRef, useCallback } from "react";
import TextField from "@mui/material/TextField";
import type { TextFieldProps } from "@mui/material/TextField";

// ── Helpers ─────────────────────────────────────────────────────────

/** Strip everything except digits. */
function toDigits(s: string): string {
  return s.replace(/\D/g, "");
}

/** Format a raw digit string (up to 8 chars) into "HH:MM:SS.CC". */
function formatDigits(digits: string): string {
  let out = "";
  for (let i = 0; i < digits.length && i < 8; i++) {
    if (i === 2 || i === 4) out += ":";
    if (i === 6) out += ".";
    out += digits[i];
  }
  return out;
}

/** Clamp a 2-digit segment string to a max value, return clamped digit string. */
function clampSegment(seg: string, max: number): string {
  const n = parseInt(seg, 10);
  if (isNaN(n)) return seg;
  if (n > max) return String(max).padStart(2, "0");
  return seg;
}

/** Validate and clamp segments in a digit string: MM ≤ 59, SS ≤ 59. */
function clampDigits(digits: string): string {
  const chars = digits.split("");
  // MM = digits[2..3]
  if (chars.length >= 4) {
    const mm = clampSegment(chars[2] + chars[3], 59);
    chars[2] = mm[0];
    chars[3] = mm[1];
  }
  // SS = digits[4..5]
  if (chars.length >= 6) {
    const ss = clampSegment(chars[4] + chars[5], 59);
    chars[4] = ss[0];
    chars[5] = ss[1];
  }
  return chars.join("");
}

/** Map a digit index (0-7) to the display cursor position. */
function digitToDisplay(digitIdx: number): number {
  if (digitIdx <= 2) return digitIdx;
  if (digitIdx <= 4) return digitIdx + 1; // after first ':'
  if (digitIdx <= 6) return digitIdx + 2; // after second ':'
  return digitIdx + 3; // after '.'
}

/** Parse formatted time string to total seconds (for min/max comparison). */
function timeToSeconds(formatted: string): number | null {
  const d = toDigits(formatted);
  if (d.length < 6) return null;
  const hh = parseInt(d.slice(0, 2), 10);
  const mm = parseInt(d.slice(2, 4), 10);
  const ss = parseInt(d.slice(4, 6), 10);
  const cc = d.length >= 8 ? parseInt(d.slice(6, 8), 10) : 0;
  return hh * 3600 + mm * 60 + ss + cc / 100;
}

/** Convert total seconds back to an 8-digit string. */
function secondsToDigits(total: number): string {
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = Math.floor(total % 60);
  const cc = Math.round((total % 1) * 100);
  return (
    String(hh).padStart(2, "0") +
    String(mm).padStart(2, "0") +
    String(ss).padStart(2, "0") +
    String(cc).padStart(2, "0")
  );
}

// ── Component ───────────────────────────────────────────────────────

export interface LegacyTimeInputProps
  extends Omit<TextFieldProps, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}

export default function LegacyTimeInput({
  value,
  onChange,
  min,
  max,
  ...textFieldProps
}: LegacyTimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const selectionStart = e.target.selectionStart ?? 0;

      // Extract digits from the new raw value.
      let digits = toDigits(raw).slice(0, 8);

      // Clamp MM and SS segments as user types.
      digits = clampDigits(digits);

      const formatted = formatDigits(digits);
      onChange(formatted);

      // Compute new cursor position.
      // Figure out which digit the cursor is at in the new input.
      const rawDigitsBefore = toDigits(raw.slice(0, selectionStart)).length;
      const newCursorPos = digitToDisplay(
        Math.min(rawDigitsBefore, digits.length),
      );

      // Schedule cursor restore after React re-renders.
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      });
    },
    [onChange],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      let digits = toDigits(value).slice(0, 8);
      digits = clampDigits(digits);

      // Min/max clamping (only if we have a full time).
      if (digits.length >= 6 && (min || max)) {
        const secs = timeToSeconds(formatDigits(digits));
        if (secs !== null) {
          const minSecs = min ? timeToSeconds(min) : null;
          const maxSecs = max ? timeToSeconds(max) : null;
          let clamped = secs;
          if (minSecs !== null && clamped < minSecs) clamped = minSecs;
          if (maxSecs !== null && clamped > maxSecs) clamped = maxSecs;
          if (clamped !== secs) {
            digits = secondsToDigits(clamped).slice(0, 8);
          }
        }
      }

      const formatted = formatDigits(digits);
      if (formatted !== value) {
        onChange(formatted);
      }

      // Forward blur to parent if provided.
      textFieldProps.onBlur?.(e);
    },
    [value, onChange, min, max, textFieldProps],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const input = inputRef.current;
      if (!input) return;

      const pos = input.selectionStart ?? 0;

      // Skip cursor over separators when pressing arrow keys.
      if (e.key === "ArrowRight") {
        const ch = value[pos];
        if (ch === ":" || ch === ".") {
          e.preventDefault();
          input.setSelectionRange(pos + 1, pos + 1);
        }
      } else if (e.key === "ArrowLeft") {
        const ch = value[pos - 1];
        if (ch === ":" || ch === ".") {
          e.preventDefault();
          input.setSelectionRange(pos - 1, pos - 1);
        }
      }

      // Forward keydown to parent if provided.
      textFieldProps.onKeyDown?.(e);
    },
    [value, textFieldProps],
  );

  return (
    <TextField
      {...textFieldProps}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={textFieldProps.placeholder ?? "HH:MM:SS.CC"}
      inputRef={inputRef}
      slotProps={{
        ...textFieldProps.slotProps,
        htmlInput: {
          ...(textFieldProps.slotProps?.htmlInput as Record<string, unknown>),
          inputMode: "numeric",
        },
      }}
    />
  );
}
