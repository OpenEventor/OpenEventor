import { useCallback, useEffect, useRef, useState } from 'react';
import Loki from 'lokijs';
import type { Passing, Competitor } from '../../../api/types';

/** Subset of competitor fields relevant to the monitor. */
export interface MonitorCompetitor {
  id: string;
  card1: string;
  card2: string;
  bib: string;
  firstName: string;
  lastName: string;
  groupId: string;
  courseId: string;
}

/** A group of passings belonging to one participant (matched via card). */
export interface ParticipantGroup {
  key: string;                  // competitorId or raw card
  competitor: MonitorCompetitor | null;
  cards: string[];
  passings: Passing[];          // sorted by timestamp ASC
  latestTimestamp: number;      // for sorting groups DESC
}

// ── SSE payload types ──────────────────────────────────────────────

interface PassingCreateAction {
  action: 'create';
  passing: Passing;
}

interface PassingUpdateAction {
  action: 'update';
  passing: Passing;
}

interface PassingDeleteAction {
  action: 'delete';
  id: string;
}

interface CompetitorUpdateAction {
  action: 'create' | 'update';
  competitor: MonitorCompetitor;
}

interface CompetitorDeleteAction {
  action: 'delete';
  id: string;
}

type PassingAction = PassingCreateAction | PassingUpdateAction | PassingDeleteAction;
type CompetitorAction = CompetitorUpdateAction | CompetitorDeleteAction;

// ── Fresh passing tracking (module-level, read by PassingBlock) ───

export const freshPassingIds = new Set<string>();

// ── Render lock (module-level, prevents bump while editing) ───────

export const renderLock = {
  count: 0,
  /** Set by useMonitorStore — calls bump() to catch up after unlock. */
  onUnlock: null as (() => void) | null,
  lock() {
    this.count++;
  },
  unlock() {
    this.count = Math.max(0, this.count - 1);
    if (this.count === 0 && this.onUnlock) {
      this.onUnlock();
    }
  },
  get locked() {
    return this.count > 0;
  },
};

// ── Pause refresh (module-level, triggers re-render after manual edits while paused) ──

export const pauseRefresh = {
  /** Set by MonitorPage — calls bump() to refresh the view while paused. */
  onRefresh: null as (() => void) | null,
  /** Request a refresh after a manual edit (delays to let SSE arrive). */
  request() {
    setTimeout(() => this.onRefresh?.(), 300);
  },
};

// ── Store ──────────────────────────────────────────────────────────

interface StoreRef {
  db: Loki;
  passings: Loki.Collection<Passing>;
  competitors: Loki.Collection<MonitorCompetitor>;
}

function createDB(): StoreRef {
  const db = new Loki('monitor', { env: 'BROWSER' });
  const passings = db.addCollection<Passing>('passings', {
    unique: ['id'],
    indices: ['card'],
  });
  const competitors = db.addCollection<MonitorCompetitor>('competitors', {
    unique: ['id'],
    indices: ['card1', 'card2', 'bib', 'courseId', 'groupId'],
  });
  return { db, passings, competitors };
}

function findCompetitorByCard(store: StoreRef, card: string): MonitorCompetitor | null {
  return store.competitors.findOne({ card1: card }) ?? store.competitors.findOne({ card2: card });
}

/** Build the sorted ParticipantGroup array from the current LokiJS state. */
function buildGroups(store: StoreRef): ParticipantGroup[] {
  const allPassings = store.passings.chain().simplesort('timestamp').data();

  // Group passings by resolved competitor (or raw card if orphan).
  const groupMap = new Map<string, { competitor: MonitorCompetitor | null; cards: Set<string>; passings: Passing[]; latest: number }>();

  for (const p of allPassings) {
    const comp = findCompetitorByCard(store, p.card);
    const key = comp ? comp.id : `card:${p.card}`;

    let group = groupMap.get(key);
    if (!group) {
      group = {
        competitor: comp,
        cards: new Set<string>(),
        passings: [],
        latest: 0,
      };
      groupMap.set(key, group);
    }

    group.cards.add(p.card);
    group.passings.push(p);
    if (p.timestamp > group.latest) {
      group.latest = p.timestamp;
    }
  }

  // Convert to array, sorted by most recent activity first.
  const groups: ParticipantGroup[] = [];
  for (const [key, g] of groupMap) {
    groups.push({
      key,
      competitor: g.competitor,
      cards: [...g.cards],
      passings: g.passings, // already sorted by timestamp ASC from chain()
      latestTimestamp: g.latest,
    });
  }

  groups.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
  return groups;
}

// ── Hook ───────────────────────────────────────────────────────────

export function useMonitorStore() {
  const storeRef = useRef<StoreRef | null>(null);
  if (!storeRef.current) {
    storeRef.current = createDB();
  }
  const store = storeRef.current;

  // Version counter to trigger re-renders.
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  // Wire render lock to bump on unlock.
  useEffect(() => {
    renderLock.onUnlock = bump;
    return () => { renderLock.onUnlock = null; };
  }, [bump]);

  /** Load initial data from REST (replaces any existing data). */
  const loadInitial = useCallback(
    (passings: Passing[], competitors: Competitor[]) => {
      store.passings.clear();
      store.competitors.clear();

      for (const p of passings) {
        store.passings.insert(p);
      }
      for (const c of competitors) {
        store.competitors.insert({
          id: c.id,
          card1: c.card1,
          card2: c.card2,
          bib: c.bib,
          firstName: c.firstName,
          lastName: c.lastName,
          groupId: c.groupId,
          courseId: c.courseId,
        });
      }
      bump();
    },
    [store, bump],
  );

  /** Apply an SSE message to the store. Returns true if state changed. */
  const applySSE = useCallback(
    (event: string, data: unknown): boolean => {
      if (event === 'passing') {
        const action = data as PassingAction;
        if (action.action === 'create') {
          const existing = store.passings.findOne({ id: action.passing.id } as LokiQuery<Passing>);
          if (!existing) {
            store.passings.insert(action.passing);
          }
          freshPassingIds.add(action.passing.id);
        } else if (action.action === 'update') {
          const existing = store.passings.findOne({ id: action.passing.id } as LokiQuery<Passing>);
          if (existing) {
            Object.assign(existing, action.passing);
            store.passings.update(existing);
          } else {
            store.passings.insert(action.passing);
          }
          freshPassingIds.add(action.passing.id);
        } else if (action.action === 'delete') {
          const existing = store.passings.findOne({ id: action.id } as LokiQuery<Passing>);
          if (existing) {
            store.passings.remove(existing);
          }
        }
        return true;
      }

      if (event === 'competitor') {
        const action = data as CompetitorAction;
        if (action.action === 'create' || action.action === 'update') {
          const existing = store.competitors.findOne({ id: action.competitor.id } as LokiQuery<MonitorCompetitor>);
          if (existing) {
            Object.assign(existing, action.competitor);
            store.competitors.update(existing);
          } else {
            store.competitors.insert(action.competitor);
          }
        } else if (action.action === 'delete') {
          const existing = store.competitors.findOne({ id: action.id } as LokiQuery<MonitorCompetitor>);
          if (existing) {
            store.competitors.remove(existing);
          }
        }
        return true;
      }

      return false;
    },
    [store],
  );

  /** Get the current grouped view. Recomputed on every call (driven by version). */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const groups = buildGroups(store);
  void version; // Used to trigger re-computation when version changes.

  return { groups, loadInitial, applySSE, bump };
}
