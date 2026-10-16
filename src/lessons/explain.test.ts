import { parseBoard, printBoard } from '@/engine';

import { sampleLesson } from './__fixtures__/fixtures';
import { endCells, explainFrames } from './explain';
import type { Lesson } from './schema';

const show = (size: 5 | 7 | 9, cells: readonly ('B' | 'W' | null)[]) =>
  printBoard({ size, cells }).trim();
const board = (ascii: string) => printBoard(parseBoard(ascii).board).trim();

describe('explainFrames (sample)', () => {
  const [s1, s2, s3] = explainFrames(sampleLesson() as Lesson);

  it('step 1: own board, liberty highlight on c4, triangle on c3, no moves', () => {
    expect(show(5, s1.start)).toBe(
      board(`
        5 . . . . .
        4 . . . . .
        3 . X O X .
        2 . . X . .
        1 . . . . .
          a b c d e
      `),
    );
    expect(s1.moves).toEqual([]);
    expect(s1.highlights).toEqual([{ kind: 'liberty', points: [{ x: 2, y: 3 }] }]);
    expect(s1.markers).toEqual([{ kind: 'triangle', point: { x: 2, y: 2 } }]);
  });

  it('step 2 starts from step 1 and captures c3 with B c4', () => {
    expect(s2.start).toEqual(endCells(s1));
    expect(s2.moves).toHaveLength(1);
    expect(s2.moves[0]).toMatchObject({
      move: { x: 2, y: 3 },
      color: 'B',
      captured: [{ x: 2, y: 2 }],
      capturedColor: 'W',
    });
    expect(show(5, endCells(s2))).toBe(
      board(`
        5 . . . . .
        4 . . X . .
        3 . X . X .
        2 . . X . .
        1 . . . . .
          a b c d e
      `),
    );
    expect(s2.highlights).toEqual([]);
    expect(s2.markers).toEqual([]);
  });

  it('step 3: own board, B d3 captures both white stones together', () => {
    expect(s3.moves[0].captured).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ]);
    expect(show(5, endCells(s3))).toBe(
      board(`
        5 . . . . .
        4 . X X . .
        3 X . . X .
        2 . X X . .
        1 . . . . .
          a b c d e
      `),
    );
  });
});
