import { Button, Stack, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { FC, InputHTMLAttributes, KeyboardEvent } from "react";
import { useEffect, useState } from "react";

type ButtonColor =
  | "inherit"
  | "primary"
  | "secondary"
  | "error"
  | "warning"
  | "info"
  | "success";

export interface DropDownMenuPromptProps {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  inputType?: string;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  cancelBtnProps?: {
    show?: boolean;
    text?: string;
    color?: ButtonColor;
    onClick?: () => void;
  };
  confirmBtnProps?: {
    text?: string;
    color?: ButtonColor;
    onClick: (value: string) => void;
  };
  i18n?: Partial<DropDownMenuPromptI18n>;
}

export interface DropDownMenuPromptI18n {
  label: string;
  placeholder: string;
  cancelLabel: string;
  confirmLabel: string;
}

const DropDownMenuPrompt: FC<DropDownMenuPromptProps> = ({
  label,
  placeholder,
  defaultValue = "",
  inputType = "text",
  inputProps,
  cancelBtnProps,
  confirmBtnProps,
  i18n,
}) => {
  const { t } = useTranslation();
  const strings: DropDownMenuPromptI18n = {
    label: t("components.promptLabel"),
    placeholder: t("components.promptPlaceholder"),
    cancelLabel: t("common.cancel"),
    confirmLabel: t("common.save"),
    ...(i18n ?? {}),
  };
  const resolvedLabel = label ?? strings.label;
  const resolvedPlaceholder = placeholder ?? strings.placeholder;
  const showLabel = Boolean(resolvedLabel);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const {
    show = false,
    text: cancelText = strings.cancelLabel,
    color: cancelColor = "inherit",
    onClick: onCancel,
  } = cancelBtnProps || {};

  const {
    text: confirmText = strings.confirmLabel,
    color: confirmColor = "primary",
    onClick: onConfirm,
  } = confirmBtnProps || { onClick: () => {} };

  const handleConfirm = () => {
    onConfirm(value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleConfirm();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel?.();
    }
  };

  return (
    <Stack spacing={1}>
      {showLabel && (
        <Typography variant="body2" sx={{
          color: "text.primary"
        }}>
          {resolvedLabel}
        </Typography>
      )}
      <TextField
        size="small"
        variant="outlined"
        type={inputType}
        value={value}
        placeholder={resolvedPlaceholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        fullWidth
        slotProps={{
          htmlInput: inputProps
        }}
      />
      <Stack spacing={1}>
        {show && (
          <Button
            size="small"
            variant="outlined"
            color={cancelColor}
            onClick={onCancel}
            fullWidth
          >
            {cancelText}
          </Button>
        )}
        <Button
          size="small"
          variant="contained"
          color={confirmColor}
          onClick={handleConfirm}
          fullWidth
        >
          {confirmText}
        </Button>
      </Stack>
    </Stack>
  );
};

export default DropDownMenuPrompt;
