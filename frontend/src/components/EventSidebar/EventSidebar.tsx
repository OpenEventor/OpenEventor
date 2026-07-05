import { useCallback, useMemo, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Drawer,
  Divider,
  List,
  ListSubheader,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  ButtonBase,
  Tooltip,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  People as PeopleIcon,
  DesktopWindows as MonitorIcon,
  Description as ProtocolsIcon,
  PinDrop as CheckpointsIcon,
  ReportProblem as ProblemsIcon,
  Route as DistancesIcon,
  GroupWork as GroupsIcon,
  SwapVert as PassingsIcon,
  Diversity3 as TeamsIcon,
  Download as DownloadIcon,
  ArrowBack as ArrowBackIcon,
  Palette as PaletteIcon,
  Logout as LogoutIcon,
  Tune as TuneIcon,
  Translate as LanguageIcon,
} from "@mui/icons-material";
import { useAuth } from "../../contexts/AuthContext.tsx";
import { useEvent } from "../../contexts/EventContext.tsx";
import { getStoredToken } from "../../api/client.ts";
import { PrivacyScreen } from "../PrivacyScreen/PrivacyScreen.tsx";
import DropDownMenu from "../DropDownMenu/DropDownMenu.tsx";
import type { DropDownMenuConfig } from "../DropDownMenu/types.ts";
import {
  ThemeModeRadioGroup,
  LanguageRadioGroup,
  HighContrastSwitch,
  CompactViewSwitch,
} from "../AppBar/AppBar.tsx";
import logoSvg from "../../assets/logo.svg";

export const DRAWER_WIDTH = 240;

type SidebarIcon = ComponentType<{ fontSize?: "small" | "inherit" | "large" | "medium" }>;

interface NavItem {
  /** Child-route segment under /events/:id; omit for pure actions like Export. */
  path?: string;
  label: string;
  Icon: SidebarIcon;
  action?: () => void;
}

interface EventSidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function EventSidebar({ mobileOpen, onClose }: EventSidebarProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { eventId, displayName, date } = useEvent();

  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [prefsAnchor, setPrefsAnchor] = useState<null | HTMLElement>(null);

  // Active page = the last path segment (child routes are single-segment).
  const activePath = location.pathname.replace(/\/+$/, "").split("/").pop();

  const formattedDate = date ? date.split("-").reverse().join(".") : "";

  const go = useCallback(
    (to: string) => {
      navigate(to);
      onClose();
    },
    [navigate, onClose],
  );

  // Export the current event's .db — mirrors EventsListPage.handleDownload.
  const handleExport = useCallback(async () => {
    onClose();
    try {
      const token = getStoredToken();
      const response = await fetch(`/api/events/${eventId}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error("Failed to export event");

      let filename = `event_${eventId}.db`;
      const disposition = response.headers.get("Content-Disposition");
      const match =
        disposition && /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
      if (match?.[1]) filename = decodeURIComponent(match[1]);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Best-effort download; surfacing errors is out of scope for the nav shell.
    }
  }, [eventId, onClose]);

  const groups: { subheader: string; items: NavItem[] }[] = useMemo(
    () => [
      {
        subheader: t("nav.groups.setup"),
        items: [
          { path: "checkpoints", label: t("nav.items.checkpoints"), Icon: CheckpointsIcon },
          { path: "distances", label: t("nav.items.distances"), Icon: DistancesIcon },
        ],
      },
      {
        subheader: t("nav.groups.participants"),
        items: [
          { path: "competitors", label: t("nav.items.competitors"), Icon: PeopleIcon },
          { path: "groups", label: t("nav.items.groups"), Icon: GroupsIcon },
          { path: "teams", label: t("nav.items.teams"), Icon: TeamsIcon },
        ],
      },
      {
        subheader: t("nav.groups.raceDay"),
        items: [
          { path: "monitor", label: t("nav.items.monitor"), Icon: MonitorIcon },
          { path: "passings", label: t("nav.items.passings"), Icon: PassingsIcon },
          { path: "problems", label: t("nav.items.problems"), Icon: ProblemsIcon },
          { path: "protocols", label: t("nav.items.protocols"), Icon: ProtocolsIcon },
        ],
      },
    ],
    [t],
  );

  const prefsMenu: DropDownMenuConfig = useMemo(
    () => ({
      items: [
        {
          icon: <PaletteIcon />,
          text: t("nav.setupTheme"),
          showNestedChevron: true,
          nested: {
            title: t("nav.setupTheme"),
            items: [
              { Component: <ThemeModeRadioGroup /> },
              { Component: <HighContrastSwitch /> },
              { Component: <CompactViewSwitch /> },
            ],
          },
        },
        {
          icon: <LanguageIcon />,
          text: t("nav.language"),
          showNestedChevron: true,
          nested: {
            title: t("nav.language"),
            items: [{ Component: <LanguageRadioGroup /> }],
          },
        },
        {
          icon: <LogoutIcon />,
          text: t("nav.logout"),
          action: () => logout(),
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  const renderItem = (item: NavItem) => {
    const active = item.path != null && item.path === activePath;
    const Icon = item.Icon;
    return (
      <ListItemButton
        key={item.path ?? item.label}
        selected={active}
        onClick={() =>
          item.path ? go(`/events/${eventId}/${item.path}`) : item.action?.()
        }
        sx={{ borderRadius: 1, mx: 1, mb: 0.25, py: 0.5 }}
      >
        <ListItemIcon sx={{ minWidth: 34, color: "inherit" }}>
          <Icon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={
            <Typography variant="body2" noWrap>
              {item.label}
            </Typography>
          }
        />
      </ListItemButton>
    );
  };

  const content = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header: brand (privacy toggle) + back link + event → settings */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
          <Tooltip title={t("nav.privacyScreen")} arrow>
            <IconButton onClick={() => setPrivacyOpen(true)} sx={{ p: 0.5 }}>
              <Box
                component="img"
                src={logoSvg}
                alt="OpenEventor"
                sx={{
                  width: 26,
                  height: 26,
                  filter:
                    theme.palette.mode === "light" ? "brightness(0)" : "none",
                }}
              />
            </IconButton>
          </Tooltip>
          <ButtonBase
            onClick={() => go("/events")}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              color: "text.secondary",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 16 }} />
            <Typography variant="body2">{t("nav.events")}</Typography>
          </ButtonBase>
        </Box>

        <ButtonBase
          onClick={() => go(`/events/${eventId}/settings`)}
          sx={{
            width: "100%",
            justifyContent: "flex-start",
            textAlign: "left",
            p: 1,
            borderRadius: 1,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
              {displayName || t("nav.event")}
            </Typography>
            {formattedDate && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {formattedDate}
              </Typography>
            )}
          </Box>
        </ButtonBase>
      </Box>

      <Divider />

      {/* Export & backup — top-level action, right under the event name */}
      <List dense disablePadding sx={{ pt: 1 }}>
        {renderItem({ label: t("nav.items.export"), Icon: DownloadIcon, action: handleExport })}
      </List>

      {/* Grouped navigation */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pb: 1 }}>
        {groups.map((group) => (
          <List
            key={group.subheader}
            dense
            disablePadding
            subheader={
              <ListSubheader
                disableSticky
                component="div"
                sx={{
                  bgcolor: "transparent",
                  color: "text.secondary",
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  lineHeight: 2.4,
                  px: 2,
                }}
              >
                {group.subheader}
              </ListSubheader>
            }
            sx={{ mb: 0.5 }}
          >
            {group.items.map(renderItem)}
          </List>
        ))}
      </Box>

      <Divider />

      {/* Footer: app preferences (theme + logout) */}
      <Box sx={{ p: 1 }}>
        <ListItemButton
          onClick={(e) => setPrefsAnchor(e.currentTarget)}
          sx={{ borderRadius: 1, py: 0.5 }}
        >
          <ListItemIcon sx={{ minWidth: 34, color: "inherit" }}>
            <TuneIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={
              <Typography variant="body2" noWrap>
                {t("nav.preferences")}
              </Typography>
            }
          />
        </ListItemButton>
      </Box>

      <DropDownMenu
        open={Boolean(prefsAnchor)}
        onClose={() => setPrefsAnchor(null)}
        menu={prefsMenu}
        anchorEl={prefsAnchor}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        width={220}
      />
      <PrivacyScreen open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </Box>
  );

  const paperBg = theme.palette.mode === "dark" ? "#1a1a1a" : "#f0f1f4";

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            bgcolor: paperBg,
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      open
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: DRAWER_WIDTH,
          boxSizing: "border-box",
          position: "relative",
          height: "100%",
          borderRight: 1,
          borderColor: "divider",
          bgcolor: paperBg,
        },
      }}
    >
      {content}
    </Drawer>
  );
}
