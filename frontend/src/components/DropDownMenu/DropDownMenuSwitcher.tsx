import type { FC, ReactNode } from "react";
import { Box, ListItemIcon, Switch, Typography } from "@mui/material";

interface DropDownMenuSwitcherProps {
  icon?: ReactNode;
  text: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const DropDownMenuSwitcher: FC<DropDownMenuSwitcherProps> = ({
  icon,
  text,
  checked,
  onChange,
}) => (
  <Box
    onClick={() => onChange(!checked)}
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
    {icon && (
      <ListItemIcon
        sx={{
          minWidth: 17,
          color: "inherit",
          "& svg": { fontSize: 14 },
        }}
      >
        {icon}
      </ListItemIcon>
    )}
    <Typography
      variant="body2"
      color="text.primary"
      noWrap
      sx={{ fontSize: "0.85rem", flex: 1 }}
    >
      {text}
    </Typography>
    <Switch
      size="small"
      checked={checked}
      onChange={(_, val) => onChange(val)}
      onClick={(e) => e.stopPropagation()}
      sx={{ ml: "auto" }}
    />
  </Box>
);

export default DropDownMenuSwitcher;
