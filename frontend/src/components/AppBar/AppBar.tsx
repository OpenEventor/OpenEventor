import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  AppBar as MuiAppBar,
  Toolbar,
  Typography,
  IconButton,
  Tooltip,
  Box,
  TextField,
  InputAdornment,
  ButtonBase,
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  People as PeopleIcon,
  DesktopWindows as MonitorIcon,
  Description as ProtocolsIcon,
  Route as DistancesIcon,
  GroupWork as GroupsIcon,
  SwapVert as PassingsIcon,
  Diversity3 as TeamsIcon,
  MoreHoriz as MoreHorizIcon,
  Settings as SettingsIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  SettingsBrightness as AutoModeIcon,
  Logout as LogoutIcon,
  Search as SearchIcon,
  Palette as PaletteIcon,
  Apps as AppsIcon,
  ArrowBack as ArrowBackIcon,
} from "@mui/icons-material";
import { useAuth } from "../../contexts/AuthContext.tsx";
import { useThemeMode } from "../../contexts/ThemeContext.tsx";
import { PrivacyScreen } from "../PrivacyScreen/PrivacyScreen.tsx";
import DropDownMenu from "../DropDownMenu/DropDownMenu.tsx";
import DropDownMenuRadioGroup from "../DropDownMenu/DropDownMenuRadioGroup.tsx";
import DropDownMenuSwitcher from "../DropDownMenu/DropDownMenuSwitcher.tsx";
import type { DropDownMenuConfig } from "../DropDownMenu/types.ts";
import { api } from "../../api/client.ts";
import type { EventItem } from "../../api/types.ts";
import logoSvg from "../../assets/logo.svg";

export const EVENT_TABS = [
  { path: "competitors", label: "Competitors", icon: PeopleIcon },
  { path: "monitor", label: "Monitor", icon: MonitorIcon },
  { path: "protocols", label: "Protocols", icon: ProtocolsIcon },
] as const;

export const MORE_TABS = [
  { path: "distances", label: "Distances", icon: DistancesIcon },
  { path: "groups", label: "Groups", icon: GroupsIcon },
  { path: "passings", label: "Passings", icon: PassingsIcon },
  { path: "teams", label: "Teams", icon: TeamsIcon },
] as const;

interface AppBarProps {
  withSearch?: boolean;
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: <LightModeIcon sx={{ fontSize: 16 }} /> },
  { value: "dark", label: "Dark", icon: <DarkModeIcon sx={{ fontSize: 16 }} /> },
  { value: "system", label: "Auto", icon: <AutoModeIcon sx={{ fontSize: 16 }} /> },
];

function ThemeModeRadioGroup() {
  const { mode, setMode } = useThemeMode();
  return (
    <DropDownMenuRadioGroup
      options={THEME_OPTIONS}
      value={mode}
      onChange={(val) => setMode(val as "light" | "dark" | "system")}
    />
  );
}

function HighContrastSwitch() {
  const { highContrast, setHighContrast } = useThemeMode();
  return (
    <DropDownMenuSwitcher
      text="High contrast"
      checked={highContrast}
      onChange={setHighContrast}
    />
  );
}

function CompactViewSwitch() {
  const { compactView, setCompactView } = useThemeMode();
  return (
    <DropDownMenuSwitcher
      text="Compact view"
      checked={compactView}
      onChange={setCompactView}
    />
  );
}

export function AppBar({ withSearch = false }: AppBarProps) {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { compactView } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [event, setEvent] = useState<EventItem | null>(null);
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
  const [moreAnchor, setMoreAnchor] = useState<null | HTMLElement>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => {
    if (!eventId) { setEvent(null); return; }
    api.get<EventItem>(`/api/events/${eventId}`).then(setEvent).catch(() => setEvent(null));
  }, [eventId]);

  const handleSettingsClose = () => setSettingsAnchor(null);
  const handleMoreClose = () => setMoreAnchor(null);

  const allTabs = [...EVENT_TABS, ...MORE_TABS];
  const activeTab = eventId
    ? allTabs.find((tab) => location.pathname.includes(`/${tab.path}`))?.path
    : undefined;
  const isMoreActive = MORE_TABS.some((tab) => tab.path === activeTab);

  const isCompact = compactView;
  const showTabsInToolbar = eventId && !isMobile && isCompact;
  const showSecondRow = eventId && !isMobile && !isCompact;

  const moreMenu: DropDownMenuConfig = useMemo(
    () => ({
      items: [
        ...MORE_TABS.map((tab) => ({
          icon: <tab.icon />,
          text: tab.label,
          action: () => {
            navigate(`/events/${eventId}/${tab.path}`);
            handleMoreClose();
          },
        })),
        {
          Component: <Divider sx={{ my: 0.5 }} />,
        },
        {
          icon: <AppsIcon />,
          text: "All modules",
          action: () => {
            navigate(`/events/${eventId}/modules`);
            handleMoreClose();
          },
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventId],
  );

  const settingsMenu: DropDownMenuConfig = useMemo(
    () => ({
      items: [
        ...(eventId
          ? [
              {
                icon: <ArrowBackIcon />,
                text: "Back to event list",
                action: () => {
                  navigate("/events");
                  handleSettingsClose();
                },
              },
              {
                icon: <SettingsIcon />,
                text: "Event settings",
                action: () => {
                  navigate(`/events/${eventId}/settings`);
                  handleSettingsClose();
                },
              },
            ]
          : []),
        {
          icon: <PaletteIcon />,
          text: "Setup theme",
          showNestedChevron: true,
          nested: {
            title: "Setup theme",
            items: [
              {
                Component: <ThemeModeRadioGroup />,
              },
              {
                Component: <HighContrastSwitch />,
              },
              {
                Component: <CompactViewSwitch />,
              },
            ],
          },
        },
        {
          icon: <LogoutIcon />,
          text: "Logout",
          action: () => {
            logout();
          },
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventId],
  );

  return (
    <>
      <PrivacyScreen open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <MuiAppBar
        position="sticky"
        elevation={0}
        color="default"
        sx={{
          bgcolor: theme.palette.mode === "dark" ? "#1a1a1a" : "#f0f1f4",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Toolbar sx={{ gap: 1, minHeight: 50, height: 50 }}>
          {/* Logo — click to toggle privacy screen */}
          <IconButton
            edge="start"
            onClick={() => setPrivacyOpen(true)}
            sx={{ p: 0.5 }}
          >
            <Box
              component="img"
              src={logoSvg}
              alt="OpenEventor"
              sx={{
                width: 32,
                height: 32,
                filter:
                  theme.palette.mode === "light" ? "brightness(0)" : "none",
              }}
            />
          </IconButton>

          {/* App name or event name */}
          {eventId ? (
            <Tooltip
              title={event ? `${event.displayName}${event.date ? ` (${event.date})` : ""}` : ""}
              arrow
            >
              <Typography
                variant="subtitle1"
                noWrap
                sx={{
                  maxWidth: 300,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
                onClick={() => navigate(`/events/${eventId}/competitors`)}
              >
                {event?.displayName || "Event"}
              </Typography>
            </Tooltip>
          ) : (
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
              OpenEventor
            </Typography>
          )}

          {/* Event tabs in compact mode (desktop only) */}
          {showTabsInToolbar && (
            <Box sx={{ display: "flex", gap: 0.5, ml: 1 }}>
              {EVENT_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.path;
                return (
                  <Tooltip key={tab.path} title={tab.label} arrow>
                    <IconButton
                      onClick={() => navigate(`/events/${eventId}/${tab.path}`)}
                      sx={{
                        bgcolor: isActive ? "action.selected" : "transparent",
                        borderRadius: 1,
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                    >
                      <Icon />
                    </IconButton>
                  </Tooltip>
                );
              })}
              <Tooltip title="More" arrow>
                <IconButton
                  onClick={(e) => setMoreAnchor(e.currentTarget)}
                  sx={{
                    bgcolor: isMoreActive ? "action.selected" : "transparent",
                    borderRadius: 1,
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <MoreHorizIcon />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />

          {/* Search field */}
          {withSearch && !isMobile && (
            <TextField
              size="small"
              variant="outlined"
              placeholder="Search..."
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon
                        fontSize="small"
                        sx={{ color: "text.secondary" }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ width: 200 }}
            />
          )}

          {/* Settings gear */}
          <Tooltip title="Settings" arrow>
            <IconButton onClick={(e) => setSettingsAnchor(e.currentTarget)}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          <DropDownMenu
            open={Boolean(settingsAnchor)}
            onClose={handleSettingsClose}
            menu={settingsMenu}
            anchorEl={settingsAnchor}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            width={220}
          />

          <DropDownMenu
            open={Boolean(moreAnchor)}
            onClose={handleMoreClose}
            menu={moreMenu}
            anchorEl={moreAnchor}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
            width={180}
          />
        </Toolbar>

        {/* Second row — tabs with text (normal mode, desktop only) */}
        {showSecondRow && (
          <Box
            sx={{
              display: "flex",
              alignItems: "stretch",
              height: 40,
              pl: 2,
              gap: 0,
            }}
          >
            {EVENT_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.path;
              return (
                <Box
                  key={tab.path}
                  sx={{
                    display: "flex",
                    alignItems: "stretch",
                    borderBottom: isActive
                      ? "2px solid"
                      : "2px solid transparent",
                    borderColor: isActive ? "primary.main" : "transparent",
                  }}
                >
                  <ButtonBase
                    onClick={() => navigate(`/events/${eventId}/${tab.path}`)}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.75,
                      px: 1.5,
                      my: 0.5,
                      mx: 0.25,
                      borderRadius: 1,
                      color: isActive ? "text.primary" : "text.secondary",
                      fontWeight: isActive ? 500 : 400,
                      "&:hover": {
                        bgcolor: "action.hover",
                      },
                    }}
                  >
                    <Icon fontSize="small" />
                    <Typography variant="body2" sx={{ fontWeight: "inherit" }}>
                      {tab.label}
                    </Typography>
                  </ButtonBase>
                </Box>
              );
            })}
            <Box
              sx={{
                display: "flex",
                alignItems: "stretch",
                borderBottom: isMoreActive ? "2px solid" : "2px solid transparent",
                borderColor: isMoreActive ? "primary.main" : "transparent",
              }}
            >
              <ButtonBase
                onClick={(e) => setMoreAnchor(e.currentTarget)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 1.5,
                  my: 0.5,
                  mx: 0.25,
                  borderRadius: 1,
                  color: isMoreActive ? "text.primary" : "text.secondary",
                  fontWeight: isMoreActive ? 500 : 400,
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
              >
                <MoreHorizIcon fontSize="small" />
                <Typography variant="body2" sx={{ fontWeight: "inherit" }}>More</Typography>
              </ButtonBase>
            </Box>
          </Box>
        )}
      </MuiAppBar>
    </>
  );
}
