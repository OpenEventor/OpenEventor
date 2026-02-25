import type { ReactNode } from "react";
import type { PopoverOrigin } from "@mui/material/Popover";

export interface DropDownMenuItem {
  icon?: ReactNode;
  text?: string;
  action?: () => void;
  nested?: DropDownMenuConfig;
  showNestedChevron?: boolean;
  Component?: ReactNode;
  disabled?: boolean;
}

export interface DropDownMenuConfig {
  title?: string;
  items: DropDownMenuItem[];
}

export interface DropDownMenuProps {
  open: boolean;
  onClose: () => void;
  menu: DropDownMenuConfig;
  anchorEl?: HTMLElement | null;
  anchorPosition?: { top: number; left: number };
  anchorOrigin?: PopoverOrigin;
  transformOrigin?: PopoverOrigin;
  width?: number | string;
  maxHeight?: number | string;
  showNestedChevron?: boolean;
}
