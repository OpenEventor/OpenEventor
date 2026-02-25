import { Stack, Typography, Button } from "@mui/material";
import type { FC } from "react";

export interface DropDownMenuConfirmProps {
  text: string;
  cancelBtnProps?: {
    show?: boolean;
    text?: string;
    color?: "inherit" | "primary" | "secondary" | "error" | "warning" | "info" | "success";
    onClick?: () => void;
  };
  confirmBtnProps?: {
    text?: string;
    color?: "inherit" | "primary" | "secondary" | "error" | "warning" | "info" | "success";
    onClick: () => void;
  };
  i18n?: Partial<DropDownMenuConfirmI18n>;
}

export interface DropDownMenuConfirmI18n {
  cancelLabel: string;
  confirmLabel: string;
}

const DEFAULT_I18N: DropDownMenuConfirmI18n = {
  cancelLabel: "Cancel",
  confirmLabel: "Confirm",
};

const DropDownMenuConfirm: FC<DropDownMenuConfirmProps> = ({
  text,
  cancelBtnProps,
  confirmBtnProps,
  i18n,
}) => {
  const strings = { ...DEFAULT_I18N, ...(i18n ?? {}) };
  const {
    show = true,
    text: cancelText = strings.cancelLabel,
    color: cancelColor = "inherit",
    onClick: onCancel,
  } = cancelBtnProps || {};

  const {
    text: confirmText = strings.confirmLabel,
    color: confirmColor = "error",
    onClick: onConfirm,
  } = confirmBtnProps || { onClick: () => {} };

  return (
    <Stack spacing={1}>
      <Typography variant="body2" color="text.primary">
        {text}
      </Typography>
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
          onClick={onConfirm}
          fullWidth
        >
          {confirmText}
        </Button>
      </Stack>
    </Stack>
  );
};

export default DropDownMenuConfirm;
