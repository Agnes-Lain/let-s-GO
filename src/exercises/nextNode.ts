import {
  isLessonUnlocked,
  mapNodes,
  type MapNode,
  type StarsByLesson,
  type UnitEntry,
} from '@/lessons';

/** The first unlocked node after `lessonId` in map order (spec §6.6), or null. */
export function nodeAfter(
  units: readonly UnitEntry[],
  progress: StarsByLesson,
  lessonId: string,
): MapNode | null {
  const nodes = mapNodes(units);
  const here = nodes.findIndex((n) => n.lesson.id === lessonId);
  return nodes.slice(here + 1).find((n) => isLessonUnlocked(units, progress, n.lesson)) ?? null;
}
