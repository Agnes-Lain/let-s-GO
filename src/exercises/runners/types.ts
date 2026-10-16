import type { Highlight, HighlightKind } from '@/board';
import { parseVertex, type BoardSize, type Vertex } from '@/engine';
import type { Exercise } from '@/lessons';

import type { AttemptAction, AttemptState } from '../attempts';
import type { FeedbackText, FrameAction } from '../ExerciseFrame';

export interface RunnerProps<E extends Exercise> {
  exercise: E;
  /** Show coordinates on the board (lesson setting). */
  coordinates: boolean;
  boardWidth: number;
  attempts: AttemptState;
  dispatch: (action: AttemptAction) => void;
  feedback: readonly FeedbackText[];
  /** *Next* / *Finish*, shown once the exercise is correct or revealed. */
  next: FrameAction;
}

/** Board highlight from lesson vertices (empty lists are dropped). */
export function highlight(kind: HighlightKind, vertices: readonly Vertex[], size: BoardSize) {
  return vertices.length === 0
    ? []
    : [{ kind, points: vertices.map((v) => parseVertex(v, size)) } satisfies Highlight];
}

/** The amber hint pulse while the hint is open and the exercise is still running. */
export function hintHighlight(exercise: Exercise, attempts: AttemptState) {
  return attempts.hintOpen && attempts.status === 'active'
    ? highlight('hint', exercise.hintPoints ?? [], exercise.size)
    : [];
}

/** Error rings stay this long before the wrong points are deselected (spec §6.4). */
export const FLASH_MS = 700;
