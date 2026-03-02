import type { FC, ReactNode } from "react";
import { Box, ListItemIcon, Radio, Typography } from "@mui/material";

interface RadioOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface DropDownMenuRadioGroupProps {
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
}

const DropDownMenuRadioGroup: FC<DropDownMenuRadioGroupProps> = ({
  options,
  value,
  onChange,
}) => (
  <>
    {options.map((option) => (
      <Box
        key={option.value}
        onClick={() => onChange(option.value)}
        sx={{
          display: "flex",
          alignItems: "center",
          borderRadius: 1.25,
          px: 0.8,
          py: 0.6,
          gap: 0.75,
          cursor: "pointer",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        {option.icon && (
          <ListItemIcon
            sx={{
              minWidth: 17,
              color: "inherit",
              "& svg": { fontSize: 14 },
            }}
          >
            {option.icon}
          </ListItemIcon>
        )}
        <Typography
          variant="body2"
          color="text.primary"
          noWrap
          sx={{ fontSize: "0.85rem", flex: 1 }}
        >
          {option.label}
        </Typography>
        <Radio
          size="small"
          checked={value === option.value}
          onChange={() => onChange(option.value)}
          onClick={(e) => e.stopPropagation()}
          sx={{ p: 0, ml: "auto" }}
        />
      </Box>
    ))}
  </>
);

export default DropDownMenuRadioGroup;
