/**
 * Resolves the effective start time for a competitor using the cascade:
 * competitor.startTime → group.startTime → course.startTime → 0
 */
export function resolveStartTime(
  competitor: { startTime: number; groupId: string; courseId: string },
  groups: Map<string, { startTime: number; courseId: string }>,
  courses: Map<string, { startTime: number }>,
): number {
  // 1. Competitor's own start time
  if (competitor.startTime > 0) return competitor.startTime;
  // 2. Group start time
  const group = competitor.groupId ? groups.get(competitor.groupId) : null;
  if (group && group.startTime > 0) return group.startTime;
  // 3. Course start time (direct or via group)
  const courseId = competitor.courseId || group?.courseId || '';
  const course = courseId ? courses.get(courseId) : null;
  if (course && course.startTime > 0) return course.startTime;
  return 0;
}
