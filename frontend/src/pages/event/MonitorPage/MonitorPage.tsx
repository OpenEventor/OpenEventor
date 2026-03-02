import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Chip, IconButton, Stack, Typography } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import TuneIcon from "@mui/icons-material/Tune";
import RefreshIcon from "@mui/icons-material/Refresh";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api } from "../../../api/client";
import type { Passing, Competitor, Course, Group } from "../../../api/types";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useEventSSE } from "../../../hooks/useEventSSE";
import { useMonitorStore, renderLock, pauseRefresh } from "./useMonitorStore";
import { usePassingSound } from "./usePassingSound";
import DropDownMenu from "../../../components/DropDownMenu/DropDownMenu";
import DropDownMenuSwitcher from "../../../components/DropDownMenu/DropDownMenuSwitcher";
import type { DropDownMenuConfig } from "../../../components/DropDownMenu/types";
import ParticipantRow from "./ParticipantRow";
import { MonitorProvider } from "./MonitorContext";

const ROW_HEIGHT = 56;

/** Compute the max updatedAt value from passings and competitors arrays. */
function computeMaxUpdatedAt(passings: Passing[], competitors: Competitor[]): string {
  let max = '';
  for (const p of passings) { if (p.updatedAt > max) max = p.updatedAt; }
  for (const c of competitors) { if (c.updatedAt > max) max = c.updatedAt; }
  return max;
}

export function MonitorPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);

  const store = useMonitorStore();
  const { play: playSound, muted, toggleMute } = usePassingSound();
  const lastUpdatedAt = useRef('');
  const [showDisabled, setShowDisabled] = useState(true);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [coursesData, setCoursesData] = useState<Course[]>([]);
  const [groupsData, setGroupsData] = useState<Group[]>([]);
  const coursesMap = useMemo(() => new Map(coursesData.map((c) => [c.id, c])), [coursesData]);
  const groupsMap = useMemo(() => new Map(groupsData.map((g) => [g.id, g])), [groupsData]);

  // Scroll anchoring: keep the user's view stable when new rows appear at top.
  const scrollAnchorRef = useRef<{ key: string; offset: number } | null>(null);

  // Frozen participant key order for when paused (rows don't reorder, new ones hidden).
  const [frozenKeys, setFrozenKeys] = useState<string[] | null>(null);
  const rawDisplayGroups = (() => {
    if (playing || !frozenKeys) return store.groups;
    const groupMap = new Map(store.groups.map((g) => [g.key, g]));
    return frozenKeys.flatMap((key) => {
      const g = groupMap.get(key);
      return g ? [g] : [];
    });
  })();

  // Filter disabled passings from each group when showDisabled is off.
  const displayGroups = useMemo(() => {
    if (showDisabled) return rawDisplayGroups;
    return rawDisplayGroups.map((g) => {
      const filtered = g.passings.filter((p) => p.enabled === 1);
      if (filtered.length === g.passings.length) return g;
      return { ...g, passings: filtered };
    });
  }, [rawDisplayGroups, showDisabled]);

  // Toggle play/pause.
  const handleTogglePlay = useCallback(() => {
    setPlaying((prev) => {
      if (prev) {
        // Pausing — freeze current row order.
        setFrozenKeys(store.groups.map((g) => g.key));
      } else {
        // Resuming — clear frozen order, live data will be used.
        setFrozenKeys(null);
      }
      return !prev;
    });
  }, [store.groups]);

  // Load initial data.
  useEffect(() => {
    if (!eventId) return;

    let cancelled = false;
    async function load() {
      try {
        const [passings, competitors, courses, groups] = await Promise.all([
          api.get<Passing[]>(`/api/events/${eventId}/passings`),
          api.get<Competitor[]>(`/api/events/${eventId}/competitors`),
          api.get<Course[]>(`/api/events/${eventId}/courses`),
          api.get<Group[]>(`/api/events/${eventId}/groups`),
        ]);
        if (!cancelled) {
          store.loadLookups(courses, groups);
          store.loadInitial(passings, competitors);
          setCoursesData(courses);
          setGroupsData(groups);
          lastUpdatedAt.current = computeMaxUpdatedAt(passings, competitors);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Handle SSE messages.
  const playingRef = useRef(playing);
  playingRef.current = playing;

  /** Save scroll anchor before bumping so we can restore after re-render. */
  const saveScrollAnchor = useCallback(() => {
    const el = parentRef.current;
    if (!el || el.scrollTop < ROW_HEIGHT) {
      scrollAnchorRef.current = null;
      return;
    }
    const topIndex = Math.floor(el.scrollTop / ROW_HEIGHT);
    const group = displayGroups[topIndex];
    if (group) {
      scrollAnchorRef.current = { key: group.key, offset: el.scrollTop % ROW_HEIGHT };
    }
  }, [displayGroups]);

  /** Bump with scroll anchoring — used everywhere instead of bare store.bump(). */
  const anchoredBump = useCallback(() => {
    saveScrollAnchor();
    store.bump();
  }, [saveScrollAnchor, store]);

  // Override renderLock.onUnlock to use anchored bump (store sets bare bump by default).
  useEffect(() => {
    renderLock.onUnlock = anchoredBump;
    return () => { renderLock.onUnlock = null; };
  }, [anchoredBump]);

  // Wire pauseRefresh: when called after manual edits, bump the store while paused.
  useEffect(() => {
    pauseRefresh.onRefresh = () => {
      if (!playingRef.current) {
        anchoredBump();
      }
    };
    return () => {
      pauseRefresh.onRefresh = null;
    };
  }, [anchoredBump]);

  const handleSSE = useCallback(
    (msg: { event: string; data: unknown }) => {
      const changed = store.applySSE(msg.event, msg.data);
      if (changed && playingRef.current && !renderLock.locked) {
        anchoredBump();
        if (msg.event === "passing") {
          playSound();
        }
      }
    },
    [store, playSound, anchoredBump],
  );

  // Incremental sync on SSE reconnect.
  const handleReconnect = useCallback(async () => {
    if (!eventId) return;
    const params = lastUpdatedAt.current
      ? `?updated_after=${encodeURIComponent(lastUpdatedAt.current)}`
      : '';
    const [passings, competitors] = await Promise.all([
      api.get<Passing[]>(`/api/events/${eventId}/passings${params}`),
      api.get<Competitor[]>(`/api/events/${eventId}/competitors${params}`),
    ]);
    store.mergeIncremental(passings, competitors);
    const newMax = computeMaxUpdatedAt(passings, competitors);
    if (newMax > lastUpdatedAt.current) lastUpdatedAt.current = newMax;
    if (playingRef.current && !renderLock.locked) anchoredBump();
  }, [eventId, store, anchoredBump]);

  // Full reload — clears store first (visual wipe), then re-fetches all data.
  const handleFullReload = useCallback(async () => {
    if (!eventId) return;
    store.loadInitial([], []);
    const [passings, competitors, courses, groups] = await Promise.all([
      api.get<Passing[]>(`/api/events/${eventId}/passings`),
      api.get<Competitor[]>(`/api/events/${eventId}/competitors`),
      api.get<Course[]>(`/api/events/${eventId}/courses`),
      api.get<Group[]>(`/api/events/${eventId}/groups`),
    ]);
    store.loadLookups(courses, groups);
    store.loadInitial(passings, competitors);
    setCoursesData(courses);
    setGroupsData(groups);
    lastUpdatedAt.current = computeMaxUpdatedAt(passings, competitors);
  }, [eventId, store]);

  const { status: sseStatus, reconnect: sseReconnect } = useEventSSE({
    eventId: eventId ?? "",
    onMessage: handleSSE,
    onReconnect: handleReconnect,
    enabled: !loading && !error,
  });

  // Virtualizer.
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: displayGroups.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // Restore scroll anchor after re-render (before paint).
  useLayoutEffect(() => {
    const anchor = scrollAnchorRef.current;
    if (!anchor) return;
    scrollAnchorRef.current = null;
    const newIndex = displayGroups.findIndex((g) => g.key === anchor.key);
    if (newIndex < 0) return;
    const el = parentRef.current;
    if (el) {
      el.scrollTop = newIndex * ROW_HEIGHT + anchor.offset;
    }
  });

  const settingsMenu: DropDownMenuConfig = useMemo(() => ({
    title: "Settings",
    items: [
      {
        Component: (
          <DropDownMenuSwitcher
            icon={showDisabled ? <VisibilityIcon /> : <VisibilityOffIcon />}
            text="Show disabled"
            checked={showDisabled}
            onChange={setShowDisabled}
          />
        ),
      },
      {
        Component: (
          <DropDownMenuSwitcher
            icon={muted ? <VolumeOffIcon /> : <VolumeUpIcon />}
            text="Play sound"
            checked={!muted}
            onChange={() => toggleMute()}
          />
        ),
      },
      {
        icon: <RefreshIcon fontSize="small" />,
        text: "Full reload",
        action: handleFullReload,
      },
    ],
  }), [showDisabled, muted, toggleMute, handleFullReload]);

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">Loading monitor...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <MonitorProvider value={{ eventId: eventId!, courses: coursesMap, groups: groupsMap }}>
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100% + 32px)", m: -2, overflow: "hidden" }}>
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          px: 1,
          height: 50,
          gap: 1,
          borderBottom: 1,
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Chip
          icon={<FiberManualRecordIcon />}
          label={
            sseStatus === "online"
              ? "Online"
              : sseStatus === "connecting"
                ? "Connecting..."
                : "Offline"
          }
          variant="outlined"
          size="medium"
          onClick={sseStatus === "offline" ? sseReconnect : undefined}
          sx={{
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: sseStatus === "offline" ? "pointer" : "default",
            "& .MuiChip-icon": {
              fontSize: 12,
              color:
                sseStatus === "online"
                  ? "success.main"
                  : sseStatus === "connecting"
                    ? "warning.main"
                    : "error.main",
            },
          }}
        />

        <IconButton
          size="small"
          onClick={handleTogglePlay}
          color={playing ? "primary" : "warning"}
          title={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <PauseIcon fontSize="small" />
          ) : (
            <PlayArrowIcon fontSize="small" />
          )}
        </IconButton>

        <IconButton
          size="small"
          onClick={(e) => setSettingsAnchor(e.currentTarget)}
          title="Settings"
          sx={{ ml: "auto" }}
        >
          <TuneIcon fontSize="small" />
        </IconButton>

        <DropDownMenu
          open={settingsAnchor !== null}
          onClose={() => setSettingsAnchor(null)}
          anchorEl={settingsAnchor}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          width={220}
          menu={settingsMenu}
        />
      </Stack>

      <Box
        ref={parentRef}
        sx={{
          flex: 1,
          overflow: "auto",
          position: "relative",
        }}
      >
        <Box
          sx={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const group = displayGroups[virtualRow.index];
            return (
              <Box
                key={group.key}
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <ParticipantRow group={group} height={ROW_HEIGHT} />
              </Box>
            );
          })}
        </Box>
      </Box>

      <Stack
        direction="row"
        alignItems="center"
        sx={{
          px: 1,
          height: 40,
          minHeight: 40,
          maxHeight: 40,
          gap: 0.5,
          borderTop: 1,
          borderColor: "divider",
          flexShrink: 0,
          flexGrow: 0,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
          Total passings: {store.stats.totalPassings}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>|</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
          Active: {store.stats.activePassings}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>|</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
          Disabled: {store.stats.disabledPassings}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>|</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
          Competitors: {store.stats.competitors}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>|</Typography>
        <Typography variant="caption" sx={{ fontSize: "0.75rem", color: store.stats.withTroubles > 0 ? "error.main" : "text.secondary" }}>
          With troubles: {store.stats.withTroubles}
        </Typography>
      </Stack>
    </Box>
    </MonitorProvider>
  );
}
