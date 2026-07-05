/**
 * Which input won when resolving a competitor's effective start time.
 * Mirrors the backend `startSource` values.
 */
export type StartSource = 'competitor' | 'group' | 'course' | 'punch' | 'none';

export interface ResolvedStart {
  /** Effective start timestamp (unix seconds); 0 when nothing is set. */
  time: number;
  /** Which cascade step supplied the time. */
  source: StartSource;
}

/**
 * Resolves the effective start time AND its source using the cascade:
 * competitor.startTime → group.startTime → course.startTime → first punch → none.
 *
 * `firstPunch` is optional; pass the earliest enabled punch timestamp to let the
 * cascade fall back to it (as the backend does). Omit it to stop at the course
 * step (the classic behaviour used for delta computation).
 */
export function resolveStartTimeWithSource(
  competitor: { startTime: number; groupId: string; courseId: string },
  groups: Map<string, { startTime: number; courseId: string }>,
  courses: Map<string, { startTime: number }>,
  firstPunch?: number | null,
): ResolvedStart {
  // 1. Competitor's own start time
  if (competitor.startTime > 0) return { time: competitor.startTime, source: 'competitor' };
  // 2. Group start time
  const group = competitor.groupId ? groups.get(competitor.groupId) : null;
  if (group && group.startTime > 0) return { time: group.startTime, source: 'group' };
  // 3. Course start time (direct or via group)
  const courseId = competitor.courseId || group?.courseId || '';
  const course = courseId ? courses.get(courseId) : null;
  if (course && course.startTime > 0) return { time: course.startTime, source: 'course' };
  // 4. First punch
  if (firstPunch && firstPunch > 0) return { time: firstPunch, source: 'punch' };
  return { time: 0, source: 'none' };
}

/**
 * Resolves the effective start time for a competitor using the cascade:
 * competitor.startTime → group.startTime → course.startTime → 0
 */
export function resolveStartTime(
  competitor: { startTime: number; groupId: string; courseId: string },
  groups: Map<string, { startTime: number; courseId: string }>,
  courses: Map<string, { startTime: number }>,
): number {
  return resolveStartTimeWithSource(competitor, groups, courses).time;
}
