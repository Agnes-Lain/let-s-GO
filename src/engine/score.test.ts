import {
  createGame,
  EngineError,
  parseBoard,
  play,
  printBoard,
  score,
  toVertex,
  type Board,
  type BoardSize,
  type Color,
  type Point,
  type ScoreResult,
} from './index';

function names(points: readonly Point[], size: BoardSize = 5): string[] {
  return points.map((p) => toVertex(p, size));
}

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof EngineError ? error.code : 'not-an-engine-error';
  }
  return undefined;
}

/** The ownership map as an ASCII board: 'X' black, 'O' white, '.' nobody. */
function ownershipDiagram(board: Board, result: ScoreResult): string {
  return printBoard({ size: board.size, cells: result.ownership as (Color | null)[] });
}

/** Every point is black's, white's or dame (spec §10 correctness check). */
function expectAllPointsCounted(board: Board, result: ScoreResult): void {
  const { black, white, dame } = result;
  expect(black.stones + black.territory + white.stones + white.territory + dame.length).toBe(
    board.size * board.size,
  );
}

// AC 28 / AC 29 board: 'o' at a4 is a white stone marked dead.
const AC28 = parseBoard(`
  5 . . X O .
  4 o . X O .
  3 . . X . O
  2 . . X O .
  1 . . X O .
    a b c d e
`);

describe('score', () => {
  it('AC 28: dead stone and dame, komi 7.5 -> W+1.5', () => {
    expect(names(AC28.marked)).toEqual(['a4']);
    const result = score(AC28.board, { komi: 7.5, deadStones: ['a4'] });
    expect(result.black).toEqual({ stones: 5, territory: 10, komi: 0, total: 15 });
    expect(result.white).toEqual({ stones: 5, territory: 4, komi: 7.5, total: 16.5 });
    expect(names(result.dame)).toEqual(['d3']);
    expect(names(result.deadStones)).toEqual(['a4']);
    expect(result.winner).toBe('W');
    expect(result.margin).toBe(1.5);
    expect(result.result).toBe('W+1.5');
    expectAllPointsCounted(AC28.board, result);
  });

  it('AC 28: ownership after removing the dead stone (a1–b5 black, e5/e4/e2/e1 white)', () => {
    const result = score(AC28.board, { komi: 7.5, deadStones: ['a4'] });
    expect(ownershipDiagram(AC28.board, result)).toBe(
      ['X X X O O', 'X X X O O', 'X X X . O', 'X X X O O', 'X X X O O'].join('\n'),
    );
  });

  it('AC 28: the same board with komi 0.5 -> B+5.5', () => {
    const result = score(AC28.board, { komi: 0.5, deadStones: ['a4'] });
    expect(result.black.total).toBe(15);
    expect(result.white.total).toBe(9.5);
    expect(result.winner).toBe('B');
    expect(result.margin).toBe(5.5);
    expect(result.result).toBe('B+5.5');
  });

  it('AC 28: the same board with komi 6 -> Draw, winner null', () => {
    const result = score(AC28.board, { komi: 6, deadStones: ['a4'] });
    expect(result.black.total).toBe(15);
    expect(result.white.total).toBe(15);
    expect(result.winner).toBeNull();
    expect(result.margin).toBe(0);
    expect(result.result).toBe('Draw');
  });

  it('AC 28: dead stones can be given as points', () => {
    const byVertex = score(AC28.board, { komi: 7.5, deadStones: ['a4'] });
    expect(score(AC28.board, { komi: 7.5, deadStones: [{ x: 0, y: 3 }] })).toEqual(byVertex);
    expect(score(AC28.board, { komi: 7.5, deadStones: AC28.marked })).toEqual(byVertex);
  });

  it('AC 29: dead stone not marked -> 10 dame, W+12.5', () => {
    const result = score(AC28.board, { komi: 7.5, deadStones: [] });
    expect(result.black).toEqual({ stones: 5, territory: 0, komi: 0, total: 5 });
    expect(result.white).toEqual({ stones: 6, territory: 4, komi: 7.5, total: 17.5 });
    expect(names(result.dame)).toEqual([
      'a1',
      'a2',
      'a3',
      'a5',
      'b1',
      'b2',
      'b3',
      'b4',
      'b5',
      'd3',
    ]);
    expect(result.deadStones).toEqual([]);
    expect(result.result).toBe('W+12.5');
    expect(result.winner).toBe('W');
    expect(result.margin).toBe(12.5);
    expectAllPointsCounted(AC28.board, result);
  });

  it('AC 29: deadStones may be omitted', () => {
    expect(score(AC28.board, { komi: 7.5 })).toEqual(
      score(AC28.board, { komi: 7.5, deadStones: [] }),
    );
  });

  it('AC 30: marking one stone of a group marks the whole group', () => {
    // 5 . . X O .
    // 4 o O X O .     a4 marked; b4 is in the same group
    // 3 . . X . O
    // 2 . . X O .
    // 1 . . X O .
    const { board } = parseBoard(`
      . . X O .
      o O X O .
      . . X . O
      . . X O .
      . . X O .
    `);
    const result = score(board, { komi: 0.5, deadStones: ['a4'] });
    expect(names(result.deadStones)).toEqual(['a4', 'b4']);
    // black 5 stones + 10 territory; white 5 + 4 + 0.5; dame d3: 15 + 9 + 1 = 25 points.
    expect(result.black).toEqual({ stones: 5, territory: 10, komi: 0, total: 15 });
    expect(result.white).toEqual({ stones: 5, territory: 4, komi: 0.5, total: 9.5 });
    expect(names(result.dame)).toEqual(['d3']);
    expect(result.result).toBe('B+5.5');
    expectAllPointsCounted(board, result);

    // Marking the other stone, or both, or one twice gives the same result.
    expect(score(board, { komi: 0.5, deadStones: ['b4'] })).toEqual(result);
    expect(score(board, { komi: 0.5, deadStones: ['b4', 'a4', 'a4'] })).toEqual(result);
  });

  it('AC 30: deadStones lists every marked group, sorted by column then row', () => {
    const result = score(AC28.board, { komi: 7.5, deadStones: ['c4', 'a4'] });
    // The black wall c1–c5 and the white stone a4 are both dead.
    expect(names(result.deadStones)).toEqual(['a4', 'c1', 'c2', 'c3', 'c4', 'c5']);
    // Only white stones remain: every empty point belongs to white.
    expect(result.black.total).toBe(0);
    expect(result.white).toEqual({ stones: 5, territory: 20, komi: 7.5, total: 32.5 });
    expect(result.dame).toEqual([]);
    expectAllPointsCounted(AC28.board, result);
  });

  it('AC 30: marking an empty point throws invalid-dead-stone', () => {
    expect(errorCode(() => score(AC28.board, { komi: 7.5, deadStones: ['a1'] }))).toBe(
      'invalid-dead-stone',
    );
    expect(errorCode(() => score(AC28.board, { komi: 7.5, deadStones: [{ x: 3, y: 2 }] }))).toBe(
      'invalid-dead-stone',
    );
  });

  it('AC 30: a dead stone that is not on the board throws invalid-dead-stone', () => {
    for (const bad of ['f1', 'i3', '', { x: 5, y: 0 }, { x: -1, y: 0 }]) {
      expect(errorCode(() => score(AC28.board, { komi: 7.5, deadStones: [bad] }))).toBe(
        'invalid-dead-stone',
      );
    }
  });

  it('AC 30: prisoners (captures) never change the score', () => {
    // W captures c3 (AC 13): captures.W = 1.
    const start = createGame(5, { setup: { B: ['c3'], W: ['c2', 'b3', 'd3'] }, toPlay: 'W' });
    const result = play(start, 'c4');
    if (!result.ok) throw new Error('c4 should be legal');
    expect(result.state.captures).toEqual({ B: 0, W: 1 });

    // The same position set up directly, with no prisoners.
    const sameBoard = createGame(5, { setup: { W: ['b3', 'c2', 'c4', 'd3'] } }).board;
    expect(result.state.board).toEqual(sameBoard);

    const scored = score(result.state.board, { komi: 0.5 });
    expect(scored).toEqual(score(sameBoard, { komi: 0.5 }));
    // Area scoring: 4 white stones + 21 empty points that touch only white.
    expect(scored.black).toEqual({ stones: 0, territory: 0, komi: 0, total: 0 });
    expect(scored.white).toEqual({ stones: 4, territory: 21, komi: 0.5, total: 25.5 });
    expect(scored.result).toBe('W+25.5');
  });

  it('AC 31: empty 9×9 board, komi 7.5 -> all 81 points dame, W+7.5', () => {
    const board = createGame(9).board;
    const result = score(board, { komi: 7.5 });
    expect(result.dame).toHaveLength(81);
    expect(names(result.dame, 9).slice(0, 3)).toEqual(['a1', 'a2', 'a3']);
    expect(result.black).toEqual({ stones: 0, territory: 0, komi: 0, total: 0 });
    expect(result.white).toEqual({ stones: 0, territory: 0, komi: 7.5, total: 7.5 });
    expect(result.ownership.every((owner) => owner === null)).toBe(true);
    expect(result.ownership).toHaveLength(81);
    expect(result.winner).toBe('W');
    expect(result.margin).toBe(7.5);
    expect(result.result).toBe('W+7.5');
  });

  it('result text for whole-number margins and a negative komi', () => {
    // black: 5 stones + 5 (column a) = 10; white: 5 stones + 10 (columns d, e) = 15
    const { board } = parseBoard(`
      . X O . .
      . X O . .
      . X O . .
      . X O . .
      . X O . .
    `);
    expect(score(board, { komi: 0 }).result).toBe('W+5');
    expect(score(board, { komi: -5 }).result).toBe('Draw');
    expect(score(board, { komi: -7.5 }).result).toBe('B+2.5');
  });

  it.each([5.25, NaN, Infinity])('komi %p throws invalid-komi', (komi) => {
    expect(errorCode(() => score(AC28.board, { komi }))).toBe('invalid-komi');
  });

  it('does not change the board or the dead-stone list', () => {
    const board = parseBoard(printBoard(AC28.board)).board;
    const dead = ['a4'];
    score(board, { komi: 7.5, deadStones: dead });
    expect(board).toEqual(AC28.board);
    expect(dead).toEqual(['a4']);
  });
});
