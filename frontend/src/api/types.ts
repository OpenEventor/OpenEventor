export interface EventItem {
  id: string;
  displayName: string;
  date: string;
  status: string;
  createdAt: string;
  modifiedAt?: string;
}

export interface RenameRule {
  rawId: string;
  name: string;
  timeAdjustment: number;
}

export interface TimingSystem {
  id: string;
  kind: 'universal' | 'ostis' | 'hub';
  name: string;
  eventId: string;
  enabled: number; // 0 | 1 (the active instance of its kind)
  rules: RenameRule[];
  hubUrl: string; // hub kind only: base address of the OpenEventor Hub
  hubSession: string; // hub kind only: hub log session being consumed
  hubCursor: number; // hub kind only: highest seq already ingested
  createdAt: string;
}

/** One timing system as reported by the hub's /v1/hello. */
export interface HubSystem {
  id: string;
  kind: string;
  name: string;
  state: 'disabled' | 'connecting' | 'connected' | 'live' | 'error';
  detail?: string;
  last_read_at?: string | null;
  reads?: number;
  error?: string | null;
}

/** GET /api/timing-systems/:id/hub-status */
export interface HubStatus {
  reachable: boolean;
  error?: string;
  hello?: {
    product?: string;
    version?: string;
    protocol?: string;
    session?: string;
    head?: number;
    clock?: { utc?: string; synced?: boolean; source?: string };
    systems?: HubSystem[];
  };
  puller?: {
    streaming: boolean;
    systemId: string;
    session: string;
    cursor: number;
    lastError: string;
    lastIngestAt: string;
  };
}

export interface Competitor {
  id: string;
  bib: string;
  card1: string;
  card2: string;
  teamId: string;
  groupId: string;
  courseId: string;
  firstName: string;
  lastName: string;
  middleName: string;
  firstNameInt: string;
  lastNameInt: string;
  gender: string;
  birthDate: string;
  birthYear: number;
  rank: string;
  rating: number;
  country: string;
  region: string;
  city: string;
  phone: string;
  email: string;
  startTime: number;
  timeAdjustment: number;
  dsq: number;
  dsqDescription: string;
  dns: number;
  dnf: number;
  outOfRank: number;
  entryNumber: string;
  price: number;
  isPaid: number;
  isCheckin: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  id: string;
  name: string;
  checkpoints: string;
  validationMode: string;
  geoTrack: string;
  length: number;
  altitude: number;
  climb: number;
  startTime: number;
  price: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Checkpoint {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  name: string;
  courseId: string;
  parentId: string;
  gender: string;
  yearFrom: number;
  yearTo: number;
  startTime: number;
  price: number;
  description: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Passing {
  id: string;
  card: string;
  checkpoint: string;
  timestamp: number;
  enabled: number;
  source: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// Files (BLOBs attached to an event, e.g. the logo)
export interface EventFile {
  id: string;
  name: string;
  mimeType: string;
  purpose: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  country: string;
  region: string;
  city: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// Problems

export type ProblemSeverity = 'info' | 'warning' | 'critical';
export type ProblemSubjectType = 'event' | 'competitor' | 'course' | 'group' | 'card';

export interface ProblemSubject {
  type: ProblemSubjectType;
  id?: string;
}

export interface Problem {
  id: string;
  severity: ProblemSeverity;
  subject: ProblemSubject;
  kind: string;
  params?: Record<string, string>;
}

export interface ProblemsResponse {
  problems: Problem[];
}

// Import types

export interface ImportParseResponse {
  rows: string[][];
  totalRows: number;
}

export interface ImportExecuteRequest {
  mode: string;
  startFromRow: number;
  mapping: Record<string, string>;
  rows: string[][];
}

export interface ImportExecuteResponse {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface ImportFieldDef {
  field: string;
  label: string;
}

// Protocols (start-list / results documents, computed on the fly by the backend)

export type ProtocolType = 'start' | 'results';
export type ProtocolGrouping = 'group' | 'course';

export interface ProtocolSplit {
  checkpoint: string;
  time: number; // ms from resolved start
  leg: number;  // ms
}

export interface ProtocolRow {
  competitorId: string;
  place: number | null;      // null = unranked / non-finisher / start list
  status: string;            // "OK"/"DSQ"/"DNF"/"DNS"/"NC"; "" for start
  outOfRank: boolean;
  isFinisher: boolean;
  bib: string;
  lastName: string;
  firstName: string;
  name: string;              // "Last First"
  groupName: string;
  teamName: string;
  country: string;
  rank: string;
  comment: string;
  birthYear: number;         // 0 = unknown
  startTime: number;         // unix seconds; 0 = unknown
  totalTime: number | null;      // ms; finishers only
  referenceTime: number | null;  // ms; non-finisher's finish-for-reference
  gapToLeader: number | null;    // ms; > 0 only
  gapToPrev: number | null;      // ms; > 0 only
  points: number | null;         // competitor rating; null when 0
  splits?: ProtocolSplit[];
}

export interface ProtocolSection {
  id: string;
  title: string;
  subtitle?: string;
  rows: ProtocolRow[];
}

export interface ProtocolOptions {
  showTeam: boolean;
  showCountry: boolean;
  showStartTime: boolean;
  showRank: boolean;
  showComment: boolean;
  showGapToLeader: boolean;
  showGapToPrevious: boolean;
  usePoints: boolean;
  printDsq: boolean;
  printDnf: boolean;
  printDns: boolean;
  pageBreakPerSection: boolean;
}

export interface ProtocolDocument {
  type: ProtocolType;
  grouping: ProtocolGrouping;
  generatedAt: string;       // RFC3339 UTC
  columns: string[];         // ordered active column keys
  showGroupColumn: boolean;
  showPointsColumn: boolean;
  options: ProtocolOptions;
  sections: ProtocolSection[];
}
