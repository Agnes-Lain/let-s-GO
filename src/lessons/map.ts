// The learning-path map as rows (spec §6.1): one row per unit, plus a row per checkpoint.
// Pure: the home screen only draws these rows.
import type { Lesson, StarsByLesson, TextKey, UnitEntry } from './schema';
import { SAMPLE_UNIT, isCheckpointUnlocked, isUnlocked, starsOf } from './unlock';

export type NodeState = 'done' | 'available' | 'locked' | 'soon';

export interface MapRow {
  key: string;
  kind: 'unit' | 'checkpoint';
  unit: number;
  /** null for a planned unit ("coming soon"). */
  lesson: Lesson | null;
  /** Unit title for units 1–16; the lesson title for the sample and for checkpoints. */
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
      titleKey: u.unit === SAMPLE_UNIT && u.lesson ? u.lesson.titleKey : `unit.${u.unit}.title`,
      state: stateOf(u.lesson !== null, isUnlocked(units, progress, u.unit), stars),
      stars,
    });
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
