# Field

## Purpose
The single wrapper that gives every form control a **static label above the input**.
This app deliberately does **not** use MUI's floating label / notched-outline style
anywhere. Every text input, select, autocomplete, date/time picker, etc. must be
wrapped in `<Field>` so the label is always visible above the control (never on the
border, no float animation).

## File
- `Field.tsx` — default export `Field`

## API
```tsx
<Field
  label={t('...')}   // static label shown above (same i18n string that used to be `label=`)
  required           // optional: red asterisk after the label
  error={boolean}    // optional: turns the label red (input keeps its own error too)
  helperText={...}   // optional: text below; normally omitted (see below)
  htmlFor="id"       // optional: label -> control association
  sx={{ width: 120 }}// optional: overrides the wrapper; narrow fields set an explicit width
>
  <TextField ... />  {/* the input, WITHOUT its own `label` prop */}
</Field>
```

## Conventions (how to convert an input)
- Remove the `label` prop from the MUI control and pass that SAME `t(...)` string to
  `<Field label={...}>`.
- **Keep the control's own `error`, `helperText`, `placeholder`, `required`,
  `disabled`, `value`/`onChange`, `slotProps`, etc. unchanged.** The wrapped input
  still renders its own helper/error text below (no float issue there). `Field` owns
  only the label; pass `error`/`required` to `Field` too so the *label* reflects them.
- Per control type:
  - **TextField** — drop `label`; wrap. (A label-less outlined TextField has no notch.)
  - **TextField select / Select** — drop `label` / delete the `<InputLabel>`; wrap;
    keep the `<MenuItem>`s and `FormHelperText`.
  - **Autocomplete** — in `renderInput`, drop `label` from the inner `<TextField>`
    (give it a `placeholder`); wrap the whole `<Autocomplete>`.
  - **X DatePicker / DateTimePicker** — drop the `label` prop; wrap.
  - **TimeInput** — has no internal label anymore; wrap it and pass the label to `Field`.

## Layout
`Field` is a full-width flex column by default, so `fullWidth` inputs fill grid cells
and column stacks, and two Fields side by side in a `Stack direction="row"` share the
row 50/50 (via flex shrink). For intrinsically narrow controls (e.g. bib, gender),
pass `sx={{ width: N }}` to keep them compact.

## Already-conforming components (do NOT wrap)
- `NumberSpinner` — renders its own static `FormLabel` above.
- `DropDownMenuPrompt` — uses `Field` internally.
- Search boxes with only a `placeholder` (no `label`) — nothing to convert.
