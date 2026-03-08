import { Autocomplete, Box, TextField } from "@mui/material";
import type { TextFieldProps } from "@mui/material";
import countries from "./countries.json";

export interface Country {
  name: string;
  alpha2: string;
  alpha3: string;
}

/** Lookup map: name (lowercase) → Country */
const byName = new Map(countries.map((c) => [c.name.toLowerCase(), c]));
/** Lookup map: alpha2 (uppercase) → Country */
const byAlpha2 = new Map(countries.map((c) => [c.alpha2, c]));
/** Lookup map: alpha3 (uppercase) → Country */
const byAlpha3 = new Map(countries.map((c) => [c.alpha3, c]));

/** Resolve a free-text value to a Country object (or null). */
function resolveCountry(value: string): Country | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  return byAlpha2.get(upper) ?? byAlpha3.get(upper) ?? byName.get(value.toLowerCase()) ?? null;
}

function FlagImg({ code, size = 20 }: { code: string; size?: number }) {
  return (
    <img
      loading="lazy"
      width={size}
      src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/w80/${code.toLowerCase()}.png 2x`}
      alt=""
      style={{ borderRadius: 2, objectFit: "cover", flexShrink: 0 }}
    />
  );
}

export interface CountryPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  variant?: TextFieldProps["variant"];
  size?: "small" | "medium";
  disabled?: boolean;
  fullWidth?: boolean;
  error?: boolean;
  helperText?: string;
}

export default function CountryPicker({
  value,
  onChange,
  label = "Country",
  variant = "filled",
  size = "small",
  disabled = false,
  fullWidth = false,
  error,
  helperText,
}: CountryPickerProps) {
  const selected = resolveCountry(value);

  return (
    <Autocomplete<Country, false, false, true>
      freeSolo
      options={countries as Country[]}
      value={selected}
      inputValue={value}
      onInputChange={(_, newValue) => onChange(newValue)}
      onChange={(_, newValue) => {
        if (newValue === null) {
          onChange("");
        } else if (typeof newValue === "string") {
          onChange(newValue);
        } else {
          onChange(newValue.alpha3);
        }
      }}
      getOptionLabel={(option) =>
        typeof option === "string" ? option : option.name
      }
      isOptionEqualToValue={(option, val) => option.alpha2 === val.alpha2}
      filterOptions={(options, { inputValue }) => {
        const q = inputValue.toLowerCase();
        if (!q) return options;
        return options.filter(
          (o) =>
            o.name.toLowerCase().includes(q) ||
            o.alpha2.toLowerCase() === q ||
            o.alpha3.toLowerCase() === q,
        );
      }}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <Box
            component="li"
            key={key}
            sx={{ "& > img": { mr: 1, flexShrink: 0 } }}
            {...rest}
          >
            <FlagImg code={option.alpha2} />
            {option.name} ({option.alpha3})
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          variant={variant}
          label={label}
          size={size}
          error={error}
          helperText={helperText}
          disabled={disabled}
          slotProps={{
            input: {
              ...params.InputProps,
              startAdornment: selected ? (
                <Box sx={{ display: "flex", alignItems: "center", ml: 0.5 }}>
                  <FlagImg code={selected.alpha2} size={18} />
                </Box>
              ) : undefined,
            },
          }}
        />
      )}
      disabled={disabled}
      fullWidth={fullWidth}
      size={size}
    />
  );
}
