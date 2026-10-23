// The learning-path map as rows (spec §6.1): one row per unit, plus a row per checkpoint.
// Pure: the home screen only draws these rows.
import type { Lesson, MapNode, StarsByLesson, TextKey, UnitEntry } from './schema';
import { isCheckpointUnlocked, isLessonUnlocked, isUnlocked, starsOf, unitLessons } from './unlock';

export type NodeState = 'done' | 'available' | 'locked' | 'soon';

export interface MapRow {
  key: string;
  kind: 'unit' | 'checkpoint';
  unit: number;
  /** null for a planned unit ("coming soon"). */
  lesson: Lesson | null;
  /** Unit title for a unit's first lesson; the lesson title for later lessons and checkpoints. */
  titleKey: TextKey;
  state: NodeState;
  stars: number;
}

/** Map rows in order, with their state for the given progress. */
export function mapRows(units: readonly UnitEntry[], progress: StarsByLesson): MapRow[] {
  return units.flatMap((u) => {
    const rows: MapRow[] = [];
    const stars = u.lesson ? starsOf(progress, u.lesson.id) : 0;
    rows.push({
      key: `unit-${u.unit}`,
      kind: 'unit',
      unit: u.unit,
      lesson: u.lesson,
      titleKey: `unit.${u.unit}.title`,
      state: stateOf(u.lesson !== null, isUnlocked(units, progress, u.unit), stars),
      stars,
    });
    // A unit's later lessons (Unit 11) get their own row, titled by the lesson.
    for (const lesson of unitLessons(u).slice(1)) {
      const lessonStars = starsOf(progress, lesson.id);
      rows.push({
        key: `lesson-${lesson.id}`,
        kind: 'unit',
        unit: u.unit,
        lesson,
        titleKey: lesson.titleKey,
        state: stateOf(true, isLessonUnlocked(units, progress, lesson), lessonStars),
        stars: lessonStars,
      });
    }
    if (u.checkpoint) {
      const checkpointStars = starsOf(progress, u.checkpoint.id);
      rows.push({
        key: `checkpoint-${u.unit}`,
        kind: 'checkpoint',
        unit: u.unit,
        lesson: u.checkpoint,
        titleKey: u.checkpoint.titleKey,
        state: stateOf(true, isCheckpointUnlocked(units, progress, u.unit), checkpointStars),
        stars: checkpointStars,
      });
    }
    return rows;
  });
}

function stateOf(hasContent: boolean, unlocked: boolean, stars: number): NodeState {
  if (!hasContent) return 'soon';
  if (!unlocked) return 'locked';
  return stars >= 1 ? 'done' : 'available';
}

/** The title of a map node: the unit title for a unit's first lesson, else the lesson's own. */
export function nodeTitleKey(units: readonly UnitEntry[], node: MapNode): TextKey {
  const entry = units.find((u) => u.unit === node.unit);
  const first = node.kind === 'lesson' && entry?.lesson?.id === node.lesson.id;
  return first ? `unit.${node.unit}.title` : node.lesson.titleKey;
}
