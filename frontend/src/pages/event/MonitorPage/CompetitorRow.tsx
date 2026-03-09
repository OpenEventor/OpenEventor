import { useRef, useCallback, useState, useEffect } from 'react';
import { Box, ButtonBase } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { Passing } from '../../../api/types';
import type { CompetitorGroup } from './useMonitorStore';
import { renderLock, pauseRefresh } from './useMonitorStore';
import { useMonitorContext } from './MonitorContext';
import CompetitorHeader from './CompetitorHeader';
import { computeDeltas } from '../../../components/PassingBlock/PassingBlock';
import { resolveStartTime } from '../../../utils/resolveStartTime';
import PassingBlock from './PassingBlock';
import GapIndicator from '../../../components/GapIndicator/GapIndicator';
import PassingsEditor from '../../../components/PassingsEditor/PassingsEditor';
import { CompetitorDialog } from '../../event/CompetitorsPage/CompetitorDialog';

const BTN_WIDTH = 24;

interface CompetitorRowProps {
  group: CompetitorGroup;
  /** Unfiltered passings (includes disabled) — used by editors. */
  allPassings: Passing[];
  height: number;
}

export default function CompetitorRow({ group, allPassings, height }: CompetitorRowProps) {
  const { eventId, groups: groupsMap, courses: coursesMap } = useMonitorContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [dialogState, setDialogState] = useState<{
    mode: 'edit' | 'add-before' | 'add-after';
    index: number;
  } | null>(null);
  const [competitorDialogMode, setCompetitorDialogMode] = useState<'view' | 'edit' | null>(null);

  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (el) setOverflows(el.scrollWidth > el.clientWidth);
  }, []);

  useEffect(() => {
    checkOverflow();
  }, [group.passings.length, checkOverflow]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => ro.disconnect();
  }, [checkOverflow]);

  const scroll = useCallback((dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 100, behavior: 'smooth' });
  }, []);

  const effectiveStartTime = group.competitor
    ? resolveStartTime(group.competitor, groupsMap, coursesMap)
    : 0;
  const deltas = computeDeltas(group.passings, effectiveStartTime || null);

  const btnSx = {
    width: BTN_WIDTH,
    minWidth: BTN_WIDTH,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'action.active',
    '&:hover': { bgcolor: 'action.hover' },
  } as const;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        height,
        borderBottom: 1,
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <CompetitorHeader
        competitor={group.competitor}
        cards={group.cards}
        courseName={group.courseName}
        groupName={group.groupName}
        onShowCompetitor={() => { renderLock.lock(); setCompetitorDialogMode('view'); }}
      />

      {overflows ? (
        <ButtonBase onClick={() => scroll(-1)} sx={btnSx}>
          <ChevronLeftIcon fontSize="small" />
        </ButtonBase>
      ) : (
        <Box sx={{ width: BTN_WIDTH, minWidth: BTN_WIDTH }} />
      )}

      <Box
        ref={scrollRef}
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',          // Firefox
          '&::-webkit-scrollbar': { display: 'none' }, // Chrome/Safari
          py: 0.25,
        }}
      >
        <GapIndicator onClick={() => setDialogState({ mode: 'add-before', index: 0 })} />
        {group.passings.map((p, i) => (
          <Box key={p.id} sx={{ display: 'flex', alignItems: 'stretch' }}>
            <PassingBlock
              passing={p}
              delta={deltas[i]}
              onMenuAction={(action) => setDialogState({ mode: action, index: i })}
            />
            <GapIndicator onClick={() => setDialogState({ mode: 'add-after', index: i })} />
          </Box>
        ))}
      </Box>

      {overflows ? (
        <ButtonBase onClick={() => scroll(1)} sx={btnSx}>
          <ChevronRightIcon fontSize="small" />
        </ButtonBase>
      ) : (
        <Box sx={{ width: BTN_WIDTH, minWidth: BTN_WIDTH }} />
      )}

      {dialogState && (
        <PassingsEditor
          open
          onClose={() => setDialogState(null)}
          eventId={eventId}
          card={group.cards[0]}
          passings={allPassings}
          initialIndex={dialogState.index}
          initialMode={dialogState.mode}
          onEditorOpen={() => renderLock.lock()}
          onEditorClose={() => renderLock.unlock()}
          onAfterSave={() => pauseRefresh.request()}
          startTimestamp={effectiveStartTime || null}
          headerContent={
            <Box sx={{ height: 56, display: 'flex', borderRadius: 1, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
              <CompetitorHeader
                competitor={group.competitor}
                cards={group.cards}
                courseName={group.courseName}
                groupName={group.groupName}
              />
            </Box>
          }
        />
      )}

      <CompetitorDialog
        open={competitorDialogMode !== null}
        mode={competitorDialogMode ?? 'view'}
        onClose={() => { setCompetitorDialogMode(null); renderLock.unlock(); }}
        onSaved={() => { setCompetitorDialogMode(null); renderLock.unlock(); }}
        onEditClick={() => setCompetitorDialogMode('edit')}
        eventId={eventId}
        competitorId={group.competitor?.id}
        withPassings={false}
      />
    </Box>
  );
}
