/* eslint-disable react-refresh/only-export-components */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  PinDrop as CheckpointsIcon,
  ReportProblem as ProblemsIcon,
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
  Translate as LanguageIcon,
} from "@mui/icons-material";
import { useAuth } from "../../contexts/AuthContext.tsx";
import { useThemeMode } from "../../contexts/ThemeContext.tsx";
import { useEventOptional } from "../../contexts/EventContext.tsx";
import { PrivacyScreen } from "../PrivacyScreen/PrivacyScreen.tsx";
import DropDownMenu from "../DropDownMenu/DropDownMenu.tsx";
import DropDownMenuRadioGroup from "../DropDownMenu/DropDownMenuRadioGroup.tsx";
import DropDownMenuSwitcher from "../DropDownMenu/DropDownMenuSwitcher.tsx";
import type { DropDownMenuConfig } from "../DropDownMenu/types.ts";
import logoSvg from "../../assets/logo.svg";

export const EVENT_TABS = [
  { path: "competitors", label: "Competitors", icon: PeopleIcon },
  { path: "monitor", label: "Monitor", icon: MonitorIcon },
  { path: "protocols", label: "Protocols", icon: ProtocolsIcon },
] as const;

export const MORE_TABS = [
  { path: "checkpoints", label: "Checkpoints", icon: CheckpointsIcon },
  { path: "distances", label: "Distances", icon: DistancesIcon },
  { path: "groups", label: "Groups", icon: GroupsIcon },
  { path: "passings", label: "Passings", icon: PassingsIcon },
  { path: "teams", label: "Teams", icon: TeamsIcon },
  { path: "problems", label: "Problems", icon: ProblemsIcon },
] as const;

interface AppBarProps {
  withSearch?: boolean;
}

export function ThemeModeRadioGroup() {
  const { t } = useTranslation();
  const { mode, setMode } = useThemeMode();
  const options = [
    { value: "light", label: t("nav.themeLight"), icon: <LightModeIcon sx={{ fontSize: 16 }} /> },
    { value: "dark", label: t("nav.themeDark"), icon: <DarkModeIcon sx={{ fontSize: 16 }} /> },
    { value: "system", label: t("nav.themeAuto"), icon: <AutoModeIcon sx={{ fontSize: 16 }} /> },
  ];
  return (
    <DropDownMenuRadioGroup
      options={options}
      value={mode}
      onChange={(val) => setMode(val as "light" | "dark" | "system")}
    />
  );
}

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
];

export function LanguageRadioGroup() {
  const { i18n } = useTranslation();
  const current = i18n.language?.split("-")[0] ?? "en";
  return (
    <DropDownMenuRadioGroup
      options={LANGUAGE_OPTIONS}
      value={LANGUAGE_OPTIONS.some((o) => o.value === current) ? current : "en"}
      onChange={(val) => i18n.changeLanguage(val)}
    />
  );
}

export function HighContrastSwitch() {
  const { t } = useTranslation();
  const { highContrast, setHighContrast } = useThemeMode();
  return (
    <DropDownMenuSwitcher
      text={t("nav.highContrast")}
      checked={highContrast}
      onChange={setHighContrast}
    />
  );
}

export function CompactViewSwitch() {
  const { t } = useTranslation();
  const { compactView, setCompactView } = useThemeMode();
  return (
    <DropDownMenuSwitcher
      text={t("nav.compactView")}
      checked={compactView}
      onChange={setCompactView}
    />
  );
}

export function AppBar({ withSearch = false }: AppBarProps) {
  const { t } = useTranslation();
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { compactView } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const eventCtx = useEventOptional();
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
  const [moreAnchor, setMoreAnchor] = useState<null | HTMLElement>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);

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
          text: t(`nav.items.${tab.path}`),
          action: () => {
            navigate(`/events/${eventId}/${tab.path}`);
            handleMoreClose();
          },
        })),
        {
          icon: <SettingsIcon />,
          text: t("nav.eventSettings"),
          action: () => {
            navigate(`/events/${eventId}/settings`);
            handleMoreClose();
          },
        },
        {
          Component: <Divider sx={{ my: 0.5 }} />,
        },
        {
          icon: <AppsIcon />,
          text: t("nav.allModules"),
          action: () => {
            navigate(`/events/${eventId}/modules`);
            handleMoreClose();
          },
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventId, t],
  );

  const settingsMenu: DropDownMenuConfig = useMemo(
    () => ({
      items: [
        ...(eventId
          ? [
              {
                icon: <ArrowBackIcon />,
                text: t("nav.backToEventList"),
                action: () => {
                  navigate("/events");
                  handleSettingsClose();
                },
              },
            ]
          : []),
        {
          icon: <PaletteIcon />,
          text: t("nav.setupTheme"),
          showNestedChevron: true,
          nested: {
            title: t("nav.setupTheme"),
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
          icon: <LanguageIcon />,
          text: t("nav.language"),
          showNestedChevron: true,
          nested: {
            title: t("nav.language"),
            items: [
              {
                Component: <LanguageRadioGroup />,
              },
            ],
          },
        },
        {
          icon: <LogoutIcon />,
          text: t("nav.logout"),
          action: () => {
            logout();
          },
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventId, t],
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
              title={eventCtx ? `${eventCtx.displayName}${eventCtx.date ? ` (${eventCtx.date.split("-").reverse().join(".")})` : ""}` : ""}
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
                {eventCtx?.displayName || t("nav.event")}
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
                  <Tooltip key={tab.path} title={t(`nav.items.${tab.path}`)} arrow>
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
              <Tooltip title={t("nav.more")} arrow>
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
              placeholder={t("common.searchPlaceholder")}
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
          <Tooltip title={t("nav.settings")} arrow>
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
                      {t(`nav.items.${tab.path}`)}
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
                <Typography variant="body2" sx={{ fontWeight: "inherit" }}>{t("nav.more")}</Typography>
              </ButtonBase>
            </Box>
          </Box>
        )}
      </MuiAppBar>
    </>
  );
}
