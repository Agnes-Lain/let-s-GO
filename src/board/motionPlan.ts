// Pure rules for board motion and sound (no React): what counts as "a stone appeared",
// and the animation numbers. Kept separate so they are unit-testable.
import type { Color, Point } from '@/engine';

import { motion } from '@/theme/tokens';

/** Placement: the new stone scales 0.9 -> 1 and fades 0.6 -> 1, ease-out. */
export const placementAnimation = {
  scaleFrom: 0.9,
  opacityFrom: 0.6,
  duration: motion.stonePlace,
} as const;

/** Capture: captured stones shrink 1 -> 0.8 and fade to 0, ease-in-out. */
export const captureAnimation = {
  scaleTo: 0.8,
  opacityTo: 0,
  duration: motion.capture,
} as const;

type Cells = readonly (Color | null)[];

/**
 * True when `lastMove` is a stone that was empty in `before` and is occupied in `after`.
 * Mount, undo (point already occupied), reset, highlight-only changes and a wrong `lastMove` are false.
 */
export function isStonePlaced(
  before: Cells,
  after: Cells,
  lastMove: Point | null,
  size: number,
): boolean {
  if (!lastMove || before.length !== after.length || after.length !== size * size) return false;
  const index = lastMove.y * size + lastMove.x;
  return after[index] != null && before[index] == null;
}
