import { BASE_PATH } from '../../basePath.ts';

// Catalog of available timing-system kinds + small helpers. Designed to grow —
// the "add" dialog renders this list, so new kinds just get an entry here.
export interface TimingKindDef {
  id: 'universal' | 'ostis';
  nameKey: string; // i18n key
  tint: string;
}

export const TIMING_CATALOG: TimingKindDef[] = [
  { id: 'universal', nameKey: 'timing.kind.universal', tint: '#2E7D32' },
  { id: 'ostis', nameKey: 'timing.kind.ostis', tint: '#EF7F1A' },
];

export function timingKindDef(id: string): TimingKindDef | undefined {
  return TIMING_CATALOG.find((k) => k.id === id);
}

/** The fixed, tokenless receive URL for a kind (e.g. …/api/timing/ostis). */
export function timingUrl(kind: string): string {
  return `${window.location.origin}${BASE_PATH}/api/timing/${kind}`;
}
