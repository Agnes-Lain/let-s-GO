// Unlock rules (spec §5.3). Derived from stars, never stored, so new content unlocks itself.
import type { Lesson, MapNode, StarsByLesson, UnitEntry } from './schema';

export function starsOf(progress: StarsByLesson, lessonId: string): number {
  return progress[lessonId]?.stars ?? 0;
}

/** Every lesson (not the checkpoint) of a unit, in order. */
export function unitLessons(entry: UnitEntry): Lesson[] {
  return entry.lesson ? [entry.lesson, ...(entry.laterLessons ?? [])] : [];
}

/** The lesson whose 1★ opens what comes after the unit (its last lesson). */
function lastLesson(entry: UnitEntry): Lesson | null {
  return unitLessons(entry).pop() ?? null;
}

/**
 * A unit is unlocked if it has a lesson and either no earlier curriculum unit has a lesson, or
 * the last lesson of the closest earlier unit with a lesson has at least 1★. Planned units never
 * unlock.
 */
export function isUnlocked(
  units: readonly UnitEntry[],
  progress: StarsByLesson,
  unit: number,
): boolean {
  const entry = units.find((u) => u.unit === unit);
  if (!entry?.lesson) return false;
  const previous = units.filter((u) => u.unit < unit && u.lesson).pop();
  const gate = previous ? lastLesson(previous) : null;
  return !gate || starsOf(progress, gate.id) >= 1;
}

/** A checkpoint opens once its unit's last lesson has at least 1★. It gates nothing (Q4). */
export function isCheckpointUnlocked(
  units: readonly UnitEntry[],
  progress: StarsByLesson,
  unit: number,
): boolean {
  const entry = units.find((u) => u.unit === unit);
  const gate = entry ? lastLesson(entry) : null;
  if (!gate || !entry?.checkpoint) return false;
  return isUnlocked(units, progress, unit) && starsOf(progress, gate.id) >= 1;
}

/**
 * Whether a lesson or checkpoint may be opened. A unit's later lesson also needs 1★ on the
 * lesson before it in the unit.
 */
export function isLessonUnlocked(
  units: readonly UnitEntry[],
  progress: StarsByLesson,
  lesson: Lesson,
): boolean {
  if (lesson.kind === 'checkpoint') return isCheckpointUnlocked(units, progress, lesson.unit);
  if (!isUnlocked(units, progress, lesson.unit)) return false;
  const entry = units.find((u) => u.unit === lesson.unit);
  const list = entry ? unitLessons(entry) : [];
  const index = list.findIndex((l) => l.id === lesson.id);
  return index <= 0 || starsOf(progress, list[index - 1].id) >= 1;
}

/** Every lesson and checkpoint in map order. */
export function mapNodes(units: readonly UnitEntry[]): MapNode[] {
  return units.flatMap((u) => {
    const nodes: MapNode[] = unitLessons(u).map((lesson) => ({
      unit: u.unit,
      kind: 'lesson' as const,
      lesson,
    }));
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

/** The unit that a run unlocked: it was locked before and is open now. */
export function newlyUnlockedUnit(
  units: readonly UnitEntry[],
  before: StarsByLesson,
  after: StarsByLesson,
): number | null {
  const unit = units.find(
    (u) => !isUnlocked(units, before, u.unit) && isUnlocked(units, after, u.unit),
  );
  return unit?.unit ?? null;
}
