import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import FormLabel from "@mui/material/FormLabel";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

export interface FieldProps {
  /**
   * Static label rendered ABOVE the input. Always visible — it never floats and
   * never sits on the input border. Pass the SAME i18n string that used to go in
   * the MUI `label=` prop.
   */
  label?: ReactNode;
  /** Appends a red asterisk to the label (presentation only). */
  required?: boolean;
  /** Error state — turns the label red. The wrapped input keeps its own `error`. */
  error?: boolean;
  /**
   * Optional helper/error text rendered below the input. Usually left undefined:
   * the wrapped MUI input renders its own `helperText` (which already sits below
   * with no float). Provided for inputs that don't render their own.
   */
  helperText?: ReactNode;
  /** `id` of the control the label points to (optional). */
  htmlFor?: string;
  /** Extra styles for the wrapper Box. Overrides the defaults (e.g. `width`). */
  sx?: SxProps<Theme>;
  children: ReactNode;
}

/**
 * Wrapper that gives any form control a STATIC label above it (the house style —
 * no MUI floating label / notch anywhere in the app).
 *
 * Layout: a full-width flex column by default, so a `fullWidth` input inside fills
 * grid cells and stacks, and two side-by-side Fields share a row 50/50. Pass `sx`
 * (e.g. `{ width: 120 }`) for intrinsically narrow controls.
 */
export default function Field({
  label,
  required,
  error,
  helperText,
  htmlFor,
  sx,
  children,
}: FieldProps) {
  return (
    <Box
      sx={[
        { display: "flex", flexDirection: "column", width: "100%", minWidth: 0 },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {label != null && label !== "" && (
        <FormLabel
          htmlFor={htmlFor}
          error={error}
          sx={{
            mb: 0.5,
            fontSize: "0.875rem",
            fontWeight: 500,
            lineHeight: 1.5,
            color: error ? "error.main" : "text.primary",
            "&.Mui-focused": { color: error ? "error.main" : "text.primary" },
          }}
        >
          {label}
          {required && (
            <Box component="span" sx={{ color: "error.main", ml: 0.25 }}>
              *
            </Box>
          )}
        </FormLabel>
      )}
      {children}
      {helperText != null && helperText !== "" && (
        <Typography
          variant="caption"
          sx={{ mt: 0.5, mx: 1.75, color: error ? "error.main" : "text.secondary" }}
        >
          {helperText}
        </Typography>
      )}
    </Box>
  );
}
