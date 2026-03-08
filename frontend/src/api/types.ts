export interface EventItem {
  id: string;
  displayName: string;
  date: string;
  status: string;
  token?: string;
  createdAt: string;
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
