import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import type {
  DropDownMenuConfig,
  DropDownMenuItem,
  DropDownMenuProps,
} from "./types";

const DEFAULT_WIDTH = 100;
const DEFAULT_MAX_HEIGHT = 360;

const DropDownMenu: FC<DropDownMenuProps> = ({
  open,
  onClose,
  menu,
  anchorEl,
  anchorPosition,
  anchorOrigin = { vertical: "bottom", horizontal: "left" },
  transformOrigin = { vertical: "top", horizontal: "left" },
  width = DEFAULT_WIDTH,
  maxHeight = DEFAULT_MAX_HEIGHT,
  showNestedChevron = false,
}) => {
  const [stack, setStack] = useState<DropDownMenuConfig[]>([menu]);
  const wasOpenRef = useRef<boolean>(false);
  const paperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setStack([menu]);
    }
    if (open && wasOpenRef.current) {
      setStack((prev) => {
        if (prev.length === 0) return [menu];
        if (prev.length === 1 && prev[0] !== menu) {
          return [menu];
        }
        if (prev[0] !== menu) {
          const next = [...prev];
          next[0] = menu;
          return next;
        }
        return prev;
      });
    }
    wasOpenRef.current = open;
  }, [menu, open]);

  useEffect(() => {
    if (!open) return;
    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && paperRef.current?.contains(target)) {
        return;
      }
      onClose();
    };
    window.addEventListener("contextmenu", handleContextMenu);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [onClose, open]);

  const currentMenu = useMemo(
    () => stack[stack.length - 1] ?? menu,
    [menu, stack]
  );

  const handleItemClick = (item: DropDownMenuItem) => {
    if (item.disabled) return;
    if (item.nested) {
      setStack((prev) => [...prev, item.nested as DropDownMenuConfig]);
      return;
    }
    if (item.action) {
      item.action();
    }
    onClose();
  };

  const handleBack = () => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const showBack = stack.length > 1;
  const handleMenuEvent = (event: ReactMouseEvent) => {
    event.stopPropagation();
  };

  return (
    <Popover
      open={open}
      onClose={onClose}
      onClick={handleMenuEvent}
      onMouseDown={handleMenuEvent}
      onContextMenu={(event: ReactMouseEvent) => {
        if (open) {
          event.preventDefault();
        }
      }}
      anchorEl={anchorEl}
      anchorReference={anchorPosition ? "anchorPosition" : "anchorEl"}
      anchorPosition={anchorPosition}
      anchorOrigin={anchorOrigin}
      transformOrigin={transformOrigin}
      PaperProps={{
        sx: {
          width,
          maxHeight,
          borderRadius: 2,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        },
        ref: paperRef,
        onClick: handleMenuEvent,
        onMouseDown: handleMenuEvent,
        onContextMenu: (event: ReactMouseEvent) => {
          event.preventDefault();
        },
      }}
    >
      <Stack sx={{ width: "100%", height: "100%", minHeight: 0 }}>
        {(showBack || currentMenu.title) && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              padding: 0.7,
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <Box
              sx={{ width: 28, display: "flex", justifyContent: "flex-start" }}
            >
              {showBack && (
                <IconButton size="small" onClick={handleBack}>
                  <ArrowBackIcon sx={{ fontSize: 18 }} />
                </IconButton>
              )}
            </Box>
            <Typography
              variant="subtitle2"
              color="text.primary"
              noWrap
              sx={{
                flex: 1,
                textAlign: "center",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              {currentMenu.title}
            </Typography>
            <Box
              sx={{ width: 28, display: "flex", justifyContent: "flex-end" }}
            >
              <IconButton size="small" onClick={onClose}>
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>
        )}

        <List
          dense
          sx={{
            padding: 0.7,
            minWidth: 0,
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            "& > *:not(:last-of-type)": { mb: 0.4 },
          }}
        >
          {currentMenu.items.map((item, index) => {
            if (item.Component) {
              return (
                <Box key={`component-${index}`} sx={{ mx: 0.4 }}>
                  {item.Component}
                </Box>
              );
            }

            return (
              <ListItemButton
                key={`${item.text}-${index}`}
                onClick={() => handleItemClick(item)}
                disabled={item.disabled}
                sx={{
                  borderRadius: 1.25,
                  px: 0.8,
                  py: 0.6,
                  gap: 0.75,
                }}
              >
                {item.icon && (
                  <ListItemIcon
                    sx={{
                      minWidth: 17,
                      color: "inherit",
                      "& svg": { fontSize: 14 },
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                )}
                {item.text && (
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        color="text.primary"
                        noWrap
                        sx={{ fontSize: "0.85rem" }}
                      >
                        {item.text}
                      </Typography>
                    }
                  />
                )}
                {item.nested &&
                  (item.showNestedChevron ?? showNestedChevron) && (
                    <ChevronRightIcon sx={{ fontSize: 16, ml: "auto" }} />
                  )}
              </ListItemButton>
            );
          })}
        </List>
      </Stack>
    </Popover>
  );
};

export default DropDownMenu;
