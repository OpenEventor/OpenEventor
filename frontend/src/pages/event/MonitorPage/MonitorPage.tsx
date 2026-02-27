import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, IconButton, Toolbar, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import { useVirtualizer } from '@tanstack/react-virtual';
import { api } from '../../../api/client';
import type { Passing, Competitor } from '../../../api/types';
import { useEventSSE } from '../../../hooks/useEventSSE';
import { useMonitorStore, type ParticipantGroup } from './useMonitorStore';
import ParticipantRow from './ParticipantRow';

const ROW_HEIGHT = 56;

export function MonitorPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);

  const store = useMonitorStore();

  // Frozen snapshot for when paused.
  const [frozenGroups, setFrozenGroups] = useState<ParticipantGroup[] | null>(null);
  const displayGroups = playing ? store.groups : (frozenGroups ?? store.groups);

  // Toggle play/pause.
  const handleTogglePlay = useCallback(() => {
    setPlaying((prev) => {
      if (prev) {
        // Pausing — freeze current state.
        setFrozenGroups(store.groups);
      } else {
        // Resuming — clear frozen state, live data will be used.
        setFrozenGroups(null);
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
          setError(err instanceof Error ? err.message : 'Failed to load data');
          setLoading(false);
        }
      }
    }
    void load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Handle SSE messages.
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const handleSSE = useCallback(
    (msg: { event: string; data: unknown }) => {
      const changed = store.applySSE(msg.event, msg.data);
      if (changed && playingRef.current) {
        store.bump();
      }
    },
    [store],
  );

  useEventSSE({
    eventId: eventId ?? '',
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar variant="dense" disableGutters sx={{ px: 1, minHeight: 40, gap: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Monitor
        </Typography>

        <IconButton
          size="small"
          onClick={handleTogglePlay}
          color={playing ? 'primary' : 'warning'}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        </IconButton>

        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {displayGroups.length} participants
        </Typography>
      </Toolbar>

      <Box
        ref={parentRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const group = displayGroups[virtualRow.index];
            return (
              <Box
                key={group.key}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
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
