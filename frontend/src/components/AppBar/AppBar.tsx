import { useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  AppBar as MuiAppBar,
  Toolbar,
  Typography,
  IconButton,
  Tooltip,
  Box,
  Radio,
  Switch,
  TextField,
  InputAdornment,
  ButtonBase,
  Stack,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  People as PeopleIcon,
  Leaderboard as LeaderboardIcon,
  GroupWork as GroupWorkIcon,
  Diversity3 as Diversity3Icon,
  MoreHoriz as MoreHorizIcon,
  Settings as SettingsIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  SettingsBrightness as AutoModeIcon,
  Logout as LogoutIcon,
  Search as SearchIcon,
  Palette as PaletteIcon,
} from "@mui/icons-material";
import { useAuth } from "../../contexts/AuthContext.tsx";
import { useThemeMode } from "../../contexts/ThemeContext.tsx";
import { PrivacyScreen } from "../PrivacyScreen/PrivacyScreen.tsx";
import DropDownMenu from "../DropDownMenu/DropDownMenu.tsx";
import type { DropDownMenuConfig } from "../DropDownMenu/types.ts";
import logoSvg from "../../assets/logo.svg";

export const EVENT_TABS = [
  { path: "competitors", label: "Competitors", icon: PeopleIcon },
  { path: "splits", label: "Splits", icon: LeaderboardIcon },
  { path: "groups", label: "Groups", icon: GroupWorkIcon },
  { path: "teams", label: "Teams", icon: Diversity3Icon },
] as const;

interface AppBarProps {
  withSearch?: boolean;
}

function ThemeRadio({
  themeValue,
  icon,
  label,
}: {
  themeValue: "light" | "dark" | "system";
  icon: React.ReactNode;
  label: string;
}) {
  const { mode, setMode } = useThemeMode();
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      onClick={() => setMode(themeValue)}
      sx={{ cursor: "pointer", py: 0.25 }}
    >
      {icon}
      <Typography variant="body2" sx={{ flex: 1, fontSize: "0.85rem" }}>
        {label}
      </Typography>
      <Radio size="small" checked={mode === themeValue} sx={{ p: 0 }} />
    </Stack>
  );
}

function HighContrastSwitch() {
  const { highContrast, setHighContrast } = useThemeMode();
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      onClick={() => setHighContrast(!highContrast)}
      sx={{ cursor: "pointer", py: 0.25 }}
    >
      <Typography variant="body2" sx={{ flex: 1, fontSize: "0.85rem" }}>
        High contrast
      </Typography>
      <Switch size="small" checked={highContrast} />
    </Stack>
  );
}

function CompactViewSwitch() {
  const { compactView, setCompactView } = useThemeMode();
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      onClick={() => setCompactView(!compactView)}
      sx={{ cursor: "pointer", py: 0.25 }}
    >
      <Typography variant="body2" sx={{ flex: 1, fontSize: "0.85rem" }}>
        Compact view
      </Typography>
      <Switch size="small" checked={compactView} />
    </Stack>
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

  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(
    null,
  );
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const handleSettingsClose = () => setSettingsAnchor(null);

  const activeTab = eventId
    ? EVENT_TABS.find((tab) => location.pathname.includes(`/${tab.path}`))?.path
    : undefined;

  const isCompact = compactView;
  const showTabsInToolbar = eventId && !isMobile && isCompact;
  const showSecondRow = eventId && !isMobile && !isCompact;

  const settingsMenu: DropDownMenuConfig = useMemo(
    () => ({
      items: [
        ...(eventId
          ? [
              {
                icon: <SettingsIcon />,
                text: "Event settings",
                action: () => {
                  navigate(`/events/${eventId}/settings`);
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
                Component: (
                  <ThemeRadio
                    themeValue="light"
                    icon={<LightModeIcon sx={{ fontSize: 16 }} />}
                    label="Light"
                  />
                ),
              },
              {
                Component: (
                  <ThemeRadio
                    themeValue="dark"
                    icon={<DarkModeIcon sx={{ fontSize: 16 }} />}
                    label="Dark"
                  />
                ),
              },
              {
                Component: (
                  <ThemeRadio
                    themeValue="system"
                    icon={<AutoModeIcon sx={{ fontSize: 16 }} />}
                    label="Auto"
                  />
                ),
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
        position="static"
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
            <Tooltip title="Event name (date)" arrow>
              <Typography
                variant="subtitle1"
                noWrap
                sx={{
                  maxWidth: 200,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
                onClick={() => navigate(`/events/${eventId}/competitors`)}
              >
                Event
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
                <IconButton sx={{ opacity: 0.5 }}>
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
                borderBottom: "2px solid transparent",
              }}
            >
              <ButtonBase
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 1.5,
                  my: 0.5,
                  mx: 0.25,
                  borderRadius: 1,
                  color: "text.secondary",
                  opacity: 0.5,
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
              >
                <MoreHorizIcon fontSize="small" />
                <Typography variant="body2">More</Typography>
              </ButtonBase>
            </Box>
          </Box>
        )}
      </MuiAppBar>
    </>
  );
}
