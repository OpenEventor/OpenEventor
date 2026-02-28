import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Chip, IconButton, Stack, Typography } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import MusicOffIcon from "@mui/icons-material/MusicOff";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api } from "../../../api/client";
import type { Passing, Competitor } from "../../../api/types";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useEventSSE } from "../../../hooks/useEventSSE";
import { useMonitorStore, renderLock, pauseRefresh } from "./useMonitorStore";
import { usePassingSound } from "./usePassingSound";
import ParticipantRow from "./ParticipantRow";

const ROW_HEIGHT = 56;

export function MonitorPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);

  const store = useMonitorStore();
  const { play: playSound, muted, toggleMute } = usePassingSound();

  // Frozen participant key order for when paused (rows don't reorder, new ones hidden).
  const [frozenKeys, setFrozenKeys] = useState<string[] | null>(null);
  const displayGroups = (() => {
    if (playing || !frozenKeys) return store.groups;
    const groupMap = new Map(store.groups.map((g) => [g.key, g]));
    return frozenKeys.flatMap((key) => {
      const g = groupMap.get(key);
      return g ? [g] : [];
    });
  })();

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
        const [passings, competitors] = await Promise.all([
          api.get<Passing[]>(`/api/events/${eventId}/passings`),
          api.get<Competitor[]>(`/api/events/${eventId}/competitors`),
        ]);
        if (!cancelled) {
          store.loadInitial(passings, competitors);
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

  // Wire pauseRefresh: when called after manual edits, bump the store while paused.
  useEffect(() => {
    pauseRefresh.onRefresh = () => {
      if (!playingRef.current) {
        store.bump();
      }
    };
    return () => {
      pauseRefresh.onRefresh = null;
    };
  }, [store]);

  const handleSSE = useCallback(
    (msg: { event: string; data: unknown }) => {
      const changed = store.applySSE(msg.event, msg.data);
      if (changed && playingRef.current && !renderLock.locked) {
        store.bump();
        if (msg.event === "passing") {
          playSound();
        }
      }
    },
    [store, playSound],
  );

  const { status: sseStatus, reconnect: sseReconnect } = useEventSSE({
    eventId: eventId ?? "",
    onMessage: handleSSE,
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
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", m: -2 }}>
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
          onClick={toggleMute}
          color={muted ? "default" : "primary"}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? (
            <MusicOffIcon fontSize="small" />
          ) : (
            <MusicNoteIcon fontSize="small" />
          )}
        </IconButton>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: "auto" }}
        >
          {displayGroups.length} participants
        </Typography>
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
    </Box>
  );
}
