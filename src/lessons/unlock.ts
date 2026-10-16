// Unlock rules (spec §5.3). Derived from stars, never stored, so new content unlocks itself.
import type { Lesson, MapNode, StarsByLesson, UnitEntry } from './schema';

/** The developer sample unit: always open in dev builds and never gates Unit 1. */
export const SAMPLE_UNIT = 0;

export function starsOf(progress: StarsByLesson, lessonId: string): number {
  return progress[lessonId]?.stars ?? 0;
}

/**
 * A unit is unlocked if it has a lesson and either no earlier curriculum unit has a lesson, or
 * the closest earlier unit with a lesson has at least 1★ on it. Planned units never unlock.
 */
export function isUnlocked(
  units: readonly UnitEntry[],
  progress: StarsByLesson,
  unit: number,
): boolean {
  const entry = units.find((u) => u.unit === unit);
  if (!entry?.lesson) return false;
  if (unit === SAMPLE_UNIT) return true;
  const previous = units.filter((u) => u.unit !== SAMPLE_UNIT && u.unit < unit && u.lesson).pop();
  return !previous?.lesson || starsOf(progress, previous.lesson.id) >= 1;
}

/** A checkpoint opens once its unit's lesson has at least 1★. It gates nothing (Q4). */
export function isCheckpointUnlocked(
  units: readonly UnitEntry[],
  progress: StarsByLesson,
  unit: number,
): boolean {
  const entry = units.find((u) => u.unit === unit);
  if (!entry?.lesson || !entry.checkpoint) return false;
  return isUnlocked(units, progress, unit) && starsOf(progress, entry.lesson.id) >= 1;
}

/** Whether a lesson or checkpoint may be opened. */
export function isLessonUnlocked(
  units: readonly UnitEntry[],
  progress: StarsByLesson,
  lesson: Lesson,
): boolean {
  return lesson.kind === 'lesson'
    ? isUnlocked(units, progress, lesson.unit)
    : isCheckpointUnlocked(units, progress, lesson.unit);
}

/** Every lesson and checkpoint in map order. */
export function mapNodes(units: readonly UnitEntry[]): MapNode[] {
  return units.flatMap((u) => {
    const nodes: MapNode[] = [];
    if (u.lesson) nodes.push({ unit: u.unit, kind: 'lesson', lesson: u.lesson });
    if (u.checkpoint) nodes.push({ unit: u.unit, kind: 'checkpoint', lesson: u.checkpoint });
    return nodes;
  });
}

/** For *Continue*: the first unlocked node with 0★ in map order, or null when none is left. */
export function nextNode(units: readonly UnitEntry[], progress: StarsByLesson): MapNode | null {
  return (
    mapNodes(units).find(
      (node) =>
        isLessonUnlocked(units, progress, node.lesson) && starsOf(progress, node.lesson.id) === 0,
    ) ?? null
  );
}

/** The unit (other than the sample) that a run unlocked: it was locked before and is open now. */
export function newlyUnlockedUnit(
  units: readonly UnitEntry[],
  before: StarsByLesson,
  after: StarsByLesson,
): number | null {
  const unit = units.find(
    (u) =>
      u.unit !== SAMPLE_UNIT &&
      !isUnlocked(units, before, u.unit) &&
      isUnlocked(units, after, u.unit),
  );
  return unit?.unit ?? null;
}
