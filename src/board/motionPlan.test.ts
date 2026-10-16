import { parseBoard } from '@/engine';
import { motion } from '@/theme/tokens';

import { captureAnimation, isStonePlaced, placementAnimation } from './motionPlan';

const cells = (rows: string[]) =>
  parseBoard(rows.map((r) => [...r].join(' ')).join('\n')).board.cells;
const e5 = { x: 2, y: 2 };

const empty = cells(['.....', '.....', '.....', '.....', '.....']);
const withE5 = cells(['.....', '.....', '..X..', '.....', '.....']);
const withTwo = cells(['.....', '.....', '..X..', '.X...', '.....']);

describe('animation config', () => {
  it('uses the motion tokens and spec numbers', () => {
    expect(placementAnimation).toEqual({
      scaleFrom: 0.9,
      opacityFrom: 0.6,
      duration: motion.stonePlace,
    });
    expect(captureAnimation).toEqual({ scaleTo: 0.8, opacityTo: 0, duration: motion.capture });
    expect(motion.stonePlace).toBe(120);
    expect(motion.capture).toBe(300);
  });
});

describe('isStonePlaced', () => {
  it('is true when lastMove was empty and is now occupied', () => {
    expect(isStonePlaced(empty, withE5, e5, 5)).toBe(true);
    expect(isStonePlaced(withE5, withTwo, { x: 1, y: 1 }, 5)).toBe(true);
  });
  it('is false for mount (same board), highlights-only change and no lastMove', () => {
    expect(isStonePlaced(withE5, withE5, e5, 5)).toBe(false);
    expect(isStonePlaced(empty, withE5, null, 5)).toBe(false);
  });
  it('is false for undo: lastMove points at an already occupied point', () => {
    expect(isStonePlaced(withTwo, withE5, e5, 5)).toBe(false);
  });
  it('is false for reset and for a lastMove that is empty', () => {
    expect(isStonePlaced(withTwo, empty, e5, 5)).toBe(false);
    expect(isStonePlaced(empty, withE5, { x: 0, y: 0 }, 5)).toBe(false);
  });
  it('is false for wrong-sized boards', () => {
    expect(isStonePlaced(empty, withE5.slice(1), e5, 5)).toBe(false);
  });
});
