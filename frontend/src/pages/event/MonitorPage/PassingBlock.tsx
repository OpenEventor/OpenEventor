import { useState, useEffect } from 'react';
import { useTheme } from '@mui/material';
import type { Passing } from '../../../api/types';
import { freshPassingIds, renderLock, pauseRefresh } from './useMonitorStore';
import { useMonitorContext } from './MonitorContext';
import InteractivePassingBlock from '../../../components/PassingBlock/InteractivePassingBlock';
import { lerpColor } from '../../../components/PassingBlock/PassingBlock';

const HIGHLIGHT_COLOR = '#0051d8';
const HIGHLIGHT_STEPS = 5;
const STEP_MS = 200;

interface MonitorPassingBlockProps {
  passing: Passing;
  /** Delta in seconds from previous enabled passing (null if first). */
  delta: number | null;
  /** Called when user picks an action from the context menu. */
  onMenuAction?: (action: 'edit' | 'add-before' | 'add-after') => void;
}

export default function PassingBlock({ passing, delta, onMenuAction }: MonitorPassingBlockProps) {
  const { eventId } = useMonitorContext();
  const theme = useTheme();
  const enabled = passing.enabled === 1;

  // Highlight animation: consume fresh flag on mount.
  const [hlStep, setHlStep] = useState<number>(() => {
    if (freshPassingIds.has(passing.id)) {
      freshPassingIds.delete(passing.id);
      return 0;
    }
    return HIGHLIGHT_STEPS;
  });

  // Consume fresh flag for updates on already-mounted component.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (freshPassingIds.has(passing.id)) {
      freshPassingIds.delete(passing.id);
      setHlStep(0);
    }
  });

  // Advance highlight step.
  useEffect(() => {
    if (hlStep >= HIGHLIGHT_STEPS) return;
    const timer = setTimeout(() => setHlStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [hlStep]);

  const normalBg = enabled
    ? theme.palette.primary.main
    : (theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[300]);

  const bgcolor = hlStep < HIGHLIGHT_STEPS
    ? lerpColor(HIGHLIGHT_COLOR, normalBg, hlStep / HIGHLIGHT_STEPS)
    : undefined;

  return (
    <InteractivePassingBlock
      passing={passing}
      delta={delta}
      eventId={eventId}
      bgcolor={bgcolor}
      onMenuAction={onMenuAction}
      onAfterToggle={() => pauseRefresh.request()}
      onContextMenuOpen={() => renderLock.lock()}
      onContextMenuClose={() => renderLock.unlock()}
    />
  );
}
