import { parseBoard, score, toVertex } from '@/engine';

import { countStones, territoryPoints } from './countView';

const { board } = parseBoard(`
  9 . . X O . . . . .
  8 . . X O . . . . .
  7 . . X O . . . . .
  6 . . X O . . . . .
  5 . O X O . . . . .
  4 . . X O . . . . .
  3 . . X O . . . . .
  2 . . X O . . . . .
  1 . . X O . . . . .
`);

describe('count view (AC 30)', () => {
  it("removes the dead stones and lists each side's territory points", () => {
    const counted = score(board, { komi: 5.5, deadStones: ['b5'] });
    expect(countStones(board.cells, ['b5'])[4 * 9 + 1]).toBeNull();
    const land = territoryPoints(counted, board.cells, ['b5']);
    expect(land.B).toHaveLength(counted.black.territory);
    expect(land.W).toHaveLength(counted.white.territory);
    expect(land.B.map((p) => toVertex(p, 9))).toContain('b5');
  });
});
