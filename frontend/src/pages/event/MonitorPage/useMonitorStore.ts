import { useCallback, useEffect, useRef, useState } from 'react';
import Loki from 'lokijs';
import type { Passing, Competitor, Course, Group } from '../../../api/types';

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
  startTime: number;
  dsq: number;
  dnf: number;
  dns: number;
}

/** A group of passings belonging to one participant (matched via card). */
export interface ParticipantGroup {
  key: string;                  // competitorId or raw card
  competitor: MonitorCompetitor | null;
  cards: string[];
  passings: Passing[];          // sorted by timestamp ASC
  latestTimestamp: number;      // for sorting groups DESC
  courseName: string;           // resolved from courseNames map
  groupName: string;            // resolved from groupNames map
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
  courseNames: Map<string, string>;
  groupNames: Map<string, string>;
  courseStartTimes: Map<string, number>;
  groupStartTimes: Map<string, number>;
  groupCourseIds: Map<string, string>;
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
  return { db, passings, competitors, courseNames: new Map(), groupNames: new Map(), courseStartTimes: new Map(), groupStartTimes: new Map(), groupCourseIds: new Map() };
}

function findCompetitorByCard(store: StoreRef, card: string): MonitorCompetitor | null {
  return store.competitors.findOne({ card1: card }) ?? store.competitors.findOne({ card2: card });
}

/** Build the sorted ParticipantGroup array from the current LokiJS state. */
function buildGroups(store: StoreRef): ParticipantGroup[] {
  const allPassings = store.passings.chain().compoundsort([['sortOrder', false], ['timestamp', false]]).data();

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
      passings: g.passings, // already sorted by sortOrder ASC, timestamp ASC from chain()
      latestTimestamp: g.latest,
      courseName: g.competitor?.courseId ? (store.courseNames.get(g.competitor.courseId) ?? '') : '',
      groupName: g.competitor?.groupId ? (store.groupNames.get(g.competitor.groupId) ?? '') : '',
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
          startTime: c.startTime,
          dsq: c.dsq,
          dnf: c.dnf,
          dns: c.dns,
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

  /** Merge incremental data from REST (upserts, does not clear). */
  const mergeIncremental = useCallback(
    (passings: Passing[], competitors: Competitor[]) => {
      for (const p of passings) {
        const existing = store.passings.findOne({ id: p.id } as LokiQuery<Passing>);
        if (existing) {
          Object.assign(existing, p);
          store.passings.update(existing);
        } else {
          store.passings.insert(p);
        }
      }
      for (const c of competitors) {
        const mapped: MonitorCompetitor = {
          id: c.id,
          card1: c.card1,
          card2: c.card2,
          bib: c.bib,
          firstName: c.firstName,
          lastName: c.lastName,
          groupId: c.groupId,
          courseId: c.courseId,
          startTime: c.startTime,
          dsq: c.dsq,
          dnf: c.dnf,
          dns: c.dns,
        };
        const existing = store.competitors.findOne({ id: c.id } as LokiQuery<MonitorCompetitor>);
        if (existing) {
          Object.assign(existing, mapped);
          store.competitors.update(existing);
        } else {
          store.competitors.insert(mapped);
        }
      }
      bump();
    },
    [store, bump],
  );

  /** Load course/group name lookup maps (called once on init and on full reload). */
  const loadLookups = useCallback(
    (courses: Course[], groups: Group[]) => {
      store.courseNames.clear();
      store.courseStartTimes.clear();
      for (const c of courses) {
        store.courseNames.set(c.id, c.name);
        store.courseStartTimes.set(c.id, c.startTime);
      }
      store.groupNames.clear();
      store.groupStartTimes.clear();
      store.groupCourseIds.clear();
      for (const g of groups) {
        store.groupNames.set(g.id, g.name);
        store.groupStartTimes.set(g.id, g.startTime);
        if (g.courseId) store.groupCourseIds.set(g.id, g.courseId);
      }
    },
    [store],
  );

  /** Get the current grouped view. Recomputed on every call (driven by version). */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const groups = buildGroups(store);
  void version; // Used to trigger re-computation when version changes.

  // Compute stats from LokiJS collections.
  const totalPassings = store.passings.count();
  const activePassings = store.passings.find({ enabled: 1 } as LokiQuery<Passing>).length;
  const stats = {
    totalPassings,
    activePassings,
    disabledPassings: totalPassings - activePassings,
    competitors: store.competitors.count(),
    withTroubles: 0, // TODO: implement trouble detection
  };

  return { groups, stats, loadInitial, mergeIncremental, loadLookups, applySSE, bump };
}
