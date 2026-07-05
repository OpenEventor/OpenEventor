import type { TFunction } from 'i18next';

// Human-readable title for a problem, from a localized template keyed by `kind`.
// Placeholders like {{courseName}} are substituted from `params`; the special
// `{{competitor}}` falls back to a localized "Unnamed competitor".
export function problemTitle(
  t: TFunction,
  kind: string,
  params?: Record<string, string>,
): string {
  const p = params ?? {};
  const competitor =
    p.competitor && p.competitor.trim()
      ? p.competitor
      : t('problems.unnamedCompetitor');
  return t(`problems.kinds.${kind}`, { ...p, competitor, defaultValue: kind });
}
