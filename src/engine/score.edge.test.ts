// QA edge cases for M1 PR 3 scoring (spec docs/specs/M1-rules-engine.md §4 D, AC 28–31, D6, D9).
// Every board below was counted by hand, point by point; the counts are in the comments and
// every test checks black + white + dame = size².

import {
  parseBoard,
  printBoard,
  score,
  toVertex,
  type Board,
  type BoardSize,
  type Color,
  type Point,
  type ScoreResult,
} from './index';

function names(points: readonly Point[], size: BoardSize): string[] {
  return points.map((p) => toVertex(p, size));
}

function ownershipDiagram(board: Board, result: ScoreResult): string {
  return printBoard({ size: board.size, cells: result.ownership as (Color | null)[] });
}

function expectAllPointsCounted(board: Board, result: ScoreResult): void {
  const { black, white, dame } = result;
  expect(black.stones + black.territory + white.stones + white.territory + dame.length).toBe(
    board.size * board.size,
  );
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

/** Board of one color with exactly the listed empty points. */
function filled(size: BoardSize, color: Color, empty: number[] = []): Board {
  const cells: (Color | null)[] = Array<Color | null>(size * size).fill(color);
  for (const index of empty) cells[index] = null;
  return { size, cells };
}

describe('QA: seki (shared liberties between living groups)', () => {
  // Inner black {b7,b6,b5,c6} has liberties {c7,c5}; inner white {d7,d6,d5} has {c7,c5}.
  // Whoever fills c7 or c5 puts itself in atari and is captured -> seki. Under area scoring the
  // shared points c7 and c5 are dame and every seki stone counts.
  // Outer white {a7..a4,b4,c4,c3,c2,c1}: territory a1–a3, b1–b3 (6).
  // Outer black {e7..e4,d4,d3,d2,d1}: territory e1–e3, f1–f7, g1–g7 (17).
  // Black 4+8 = 12 stones + 17 = 29; white 3+9 = 12 stones + 6 = 18; dame 2 -> 29+18+2 = 49.
  const SEKI = parseBoard(`
    7 O X . O X . .
    6 O X X O X . .
    5 O X . O X . .
    4 O O O X X . .
    3 . . O X . . .
    2 . . O X . . .
    1 . . O X . . .
      a b c d e f g
  `).board;

  it('shared liberties are dame, seki stones count; komi 7.5 -> B+3.5', () => {
    const result = score(SEKI, { komi: 7.5 });
    expect(result.black).toEqual({ stones: 12, territory: 17, komi: 0, total: 29 });
    expect(result.white).toEqual({ stones: 12, territory: 6, komi: 7.5, total: 25.5 });
    expect(names(result.dame, 7)).toEqual(['c5', 'c7']);
    expect(result.result).toBe('B+3.5');
    expect(result.winner).toBe('B');
    expectAllPointsCounted(SEKI, result);
    expect(ownershipDiagram(SEKI, result)).toBe(
      [
        'O X . O X X X',
        'O X X O X X X',
        'O X . O X X X',
        'O O O X X X X',
        'O O O X X X X',
        'O O O X X X X',
        'O O O X X X X',
      ].join('\n'),
    );
  });

  it('same seki with komi 0.5 -> B+10.5', () => {
    const result = score(SEKI, { komi: 0.5 });
    expect(result.white.total).toBe(18.5);
    expect(result.result).toBe('B+10.5');
    expectAllPointsCounted(SEKI, result);
  });
});

describe('QA: territory on edges and in corners, several regions per color', () => {
  // Black corners a1, g1 and edge d1; white corners a7, g7 and edge d7 -> 3 + 3 territory.
  // Black stones b1 c1 e1 f1 a2 d2 g2 (7); white stones b7 c7 e7 f7 a6 d6 g6 (7).
  // The remaining 29 empty points form one region touching both colors -> dame.
  // 7+3 + 7+3 + 29 = 49.
  const EDGES = parseBoard(`
    7 . O O . O O .
    6 O . . O . . O
    5 . . . . . . .
    4 . . . . . . .
    3 . . . . . . .
    2 X . . X . . X
    1 . X X . X X .
      a b c d e f g
  `).board;

  it('counts each corner and edge region for its owner; komi 0.5 -> W+0.5', () => {
    const result = score(EDGES, { komi: 0.5 });
    expect(result.black).toEqual({ stones: 7, territory: 3, komi: 0, total: 10 });
    expect(result.white).toEqual({ stones: 7, territory: 3, komi: 0.5, total: 10.5 });
    expect(result.dame).toHaveLength(29);
    expect(result.result).toBe('W+0.5');
    expectAllPointsCounted(EDGES, result);
    const own = result.ownership;
    const at = (v: string) => own[EDGES.size * (Number(v.slice(1)) - 1) + (v.charCodeAt(0) - 97)];
    expect(['a1', 'd1', 'g1'].map(at)).toEqual(['B', 'B', 'B']);
    expect(['a7', 'd7', 'g7'].map(at)).toEqual(['W', 'W', 'W']);
    expect(['b2', 'd4', 'f6'].map(at)).toEqual([null, null, null]);
  });

  it('komi 0 -> Draw (10 - 10)', () => {
    const result = score(EDGES, { komi: 0 });
    expect(result.winner).toBeNull();
    expect(result.margin).toBe(0);
    expect(result.result).toBe('Draw');
  });

  it('one gap in a wall turns the whole region into dame', () => {
    // Remove black e1: d1 and e1 join the big region through e2, which touches white -> dame.
    const cells = [...EDGES.cells];
    cells[4] = null; // e1
    const board: Board = { size: 7, cells };
    const result = score(board, { komi: 0.5 });
    // black 6 stones + a1 + g1 = 8; d1 and e1 joined the big region: 29 + 2 = 31 dame.
    expect(result.black).toEqual({ stones: 6, territory: 2, komi: 0, total: 8 });
    expect(result.dame).toHaveLength(31);
    expectAllPointsCounted(board, result);
  });
});

describe('QA: dead stones', () => {
  it('a dead stone of the surrounding color (wrong marking) changes stone into territory', () => {
    // Black a3 marked dead inside black's own area: removed, its point becomes empty and the
    // region a1–a5, b1–b5 is still bordered only by black -> black territory 10.
    // black 5 + 10 = 15 (unmarked: 6 + 9 = 15 — the same total); white 5 + 4; dame d3.
    const { board } = parseBoard(`
      5 . . X O .
      4 . . X O .
      3 X . X . O
      2 . . X O .
      1 . . X O .
        a b c d e
    `);
    const marked = score(board, { komi: 7.5, deadStones: ['a3'] });
    expect(names(marked.deadStones, 5)).toEqual(['a3']);
    expect(marked.black).toEqual({ stones: 5, territory: 10, komi: 0, total: 15 });
    expect(marked.white).toEqual({ stones: 5, territory: 4, komi: 7.5, total: 16.5 });
    expect(names(marked.dame, 5)).toEqual(['d3']);
    expect(marked.ownership[2 * 5 + 0]).toBe('B');
    expectAllPointsCounted(board, marked);

    const unmarked = score(board, { komi: 7.5 });
    expect(unmarked.black).toEqual({ stones: 6, territory: 9, komi: 0, total: 15 });
    expect(unmarked.result).toBe(marked.result);
    expectAllPointsCounted(board, unmarked);
  });

  it('marking every stone on the board leaves only dame (no stones -> nobody owns)', () => {
    const { board } = parseBoard(`
      . . . . .
      . . X . .
      . X X . .
      . . . . .
      . . . . .
    `);
    const result = score(board, { komi: 0.5, deadStones: ['c4'] });
    expect(names(result.deadStones, 5)).toEqual(['b3', 'c3', 'c4']);
    expect(result.dame).toHaveLength(25);
    expect(result.black.total).toBe(0);
    expect(result.result).toBe('W+0.5');
    expectAllPointsCounted(board, result);
  });

  it('dead groups of both colors at once (7×7)', () => {
    // Black wall c1–c7, white wall e1–e7, column d is dame (7).
    // Dead white {a6,b6} and {b2} on black's side; dead black {f3,f4,g4} on white's side.
    // After removal: black 7 + 14 = 21; white 7 + 14 = 21; dame 7 -> 49.
    const { board } = parseBoard(`
      7 . . X . O . .
      6 o o X . O . .
      5 . . X . O . .
      4 . . X . O x x
      3 . . X . O x .
      2 . o X . O . .
      1 . . X . O . .
        a b c d e f g
    `);
    const result = score(board, { komi: 0.5, deadStones: ['a6', 'g4', 'b2'] });
    expect(names(result.deadStones, 7)).toEqual(['a6', 'b2', 'b6', 'f3', 'f4', 'g4']);
    expect(result.black).toEqual({ stones: 7, territory: 14, komi: 0, total: 21 });
    expect(result.white).toEqual({ stones: 7, territory: 14, komi: 0.5, total: 21.5 });
    expect(names(result.dame, 7)).toEqual(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7']);
    expect(result.result).toBe('W+0.5');
    expectAllPointsCounted(board, result);
    expect(score(board, { komi: 7.5, deadStones: ['b6', 'f3', 'b2'] }).result).toBe('W+7.5');

    // Unmarked: both sides' areas touch the other color -> only stones count; 11 + 11 + 7 dame.
    const unmarked = score(board, { komi: 0.5 });
    expect(unmarked.black).toEqual({ stones: 10, territory: 0, komi: 0, total: 10 });
    expect(unmarked.white).toEqual({ stones: 10, territory: 0, komi: 0.5, total: 10.5 });
    expect(unmarked.dame).toHaveLength(29);
    expectAllPointsCounted(board, unmarked);
  });

  it('dead stones are accepted in upper case and as mixed Point/Vertex lists', () => {
    const { board, marked } = parseBoard(`
      . . X O .
      o . X O .
      . . X . O
      . . X O .
      . . X O .
    `);
    const byMarked = score(board, { komi: 7.5, deadStones: marked });
    expect(score(board, { komi: 7.5, deadStones: ['A4'] })).toEqual(byMarked);
    expect(score(board, { komi: 7.5, deadStones: ['a4', { x: 0, y: 3 }] })).toEqual(byMarked);
  });
});

describe('QA: full-board scoring 9×9', () => {
  // Black wall c9 c8 c7 c6 d6 d5 d4 d3 e3 e2 e1 (11) + dead black h7; white e9 d8 d7 e6 e5 e4
  // f4 f3 f2 f1 (10) + dead white b5. d9 touches c9 (B), e9 (W), d8 (W) -> dame.
  // Black territory (dead b5 removed): a9–a1, b9–b1 (18) + c5 c4 c3 c2 c1 + d2 d1 (7) = 25.
  // White territory (dead h7 removed): f9–j9 (4) + e8–j8 (5) + e7–j7 (5) + f6–j6 (4)
  //   + f5–j5 (4) + g4–g1..j4–j1 (12) = 34.
  // black 11 + 25 = 36; white 10 + 34 = 44; dame 1 -> 36 + 44 + 1 = 81.
  const GAME = parseBoard(`
    9 . . X . O . . . .
    8 . . X O . . . . .
    7 . . X O . . . x .
    6 . . X X O . . . .
    5 . o . X O . . . .
    4 . . . X O O . . .
    3 . . . X X O . . .
    2 . . . . X O . . .
    1 . . . . X O . . .
      a b c d e f g h j
  `);

  it('komi 7.5 -> W+15.5', () => {
    const result = score(GAME.board, { komi: 7.5, deadStones: GAME.marked });
    expect(names(result.deadStones, 9)).toEqual(['b5', 'h7']);
    expect(result.black).toEqual({ stones: 11, territory: 25, komi: 0, total: 36 });
    expect(result.white).toEqual({ stones: 10, territory: 34, komi: 7.5, total: 51.5 });
    expect(names(result.dame, 9)).toEqual(['d9']);
    expect(result.result).toBe('W+15.5');
    expectAllPointsCounted(GAME.board, result);
  });

  it('komi 0.5 -> W+8.5', () => {
    const result = score(GAME.board, { komi: 0.5, deadStones: ['h7', 'b5'] });
    expect(result.white.total).toBe(44.5);
    expect(result.result).toBe('W+8.5');
    expectAllPointsCounted(GAME.board, result);
  });

  it('unmarked: both large regions touch an enemy stone and become dame', () => {
    const result = score(GAME.board, { komi: 7.5 });
    // black 12 stones, white 11 stones; 25 + 34 - 2 (dead points now occupied) + 1 = 58 dame.
    expect(result.black).toEqual({ stones: 12, territory: 0, komi: 0, total: 12 });
    expect(result.white).toEqual({ stones: 11, territory: 0, komi: 7.5, total: 18.5 });
    expect(result.dame).toHaveLength(58);
    expect(result.result).toBe('W+6.5');
    expectAllPointsCounted(GAME.board, result);
  });
});

describe('QA: boards filled by one color, large margins, result text', () => {
  it('5×5 filled entirely by black (no liberties, still scorable): B+24.5', () => {
    const board = filled(5, 'B');
    const result = score(board, { komi: 0.5 });
    expect(result.black).toEqual({ stones: 25, territory: 0, komi: 0, total: 25 });
    expect(result.dame).toEqual([]);
    expect(result.result).toBe('B+24.5');
    expectAllPointsCounted(board, result);
  });

  it('19×19 black everywhere except one eye: B+353.5 with komi 7.5', () => {
    const board = filled(19, 'B', [180]); // k10
    const result = score(board, { komi: 7.5 });
    expect(result.black).toEqual({ stones: 360, territory: 1, komi: 0, total: 361 });
    expect(result.result).toBe('B+353.5');
    expectAllPointsCounted(board, result);
  });

  it('19×19 white everywhere except two eyes: W+368.5 (komi 7.5) and W+361 (komi 0)', () => {
    const board = filled(19, 'W', [0, 360]); // a1, t19
    expect(score(board, { komi: 7.5 }).result).toBe('W+368.5');
    const result = score(board, { komi: 0 });
    expect(result.white).toEqual({ stones: 359, territory: 2, komi: 0, total: 361 });
    expect(result.result).toBe('W+361');
    expect(result.margin).toBe(361);
    expectAllPointsCounted(board, result);
  });

  it.each([
    [0.5, 'W+0.5'],
    [-0.5, 'B+0.5'],
    [0, 'Draw'],
    [100, 'W+100'],
    [-12.5, 'B+12.5'],
  ])('empty 5×5 with komi %p -> %s', (komi, text) => {
    const result = score(filled(5, 'B', [...Array(25).keys()]), { komi });
    expect(result.result).toBe(text);
    expect(result.margin).toBe(Math.abs(komi));
    expect(result.dame).toHaveLength(25);
  });

  it.each([7, 13])('empty %i×%i board: everything is dame', (size) => {
    const board = filled(size as BoardSize, 'B', [...Array(size * size).keys()]);
    const result = score(board, { komi: 7.5 });
    expect(result.dame).toHaveLength(size * size);
    expect(result.result).toBe('W+7.5');
  });
});

describe('QA: score purity (AC 24)', () => {
  it('deep-frozen board and dead-stone list with Point objects of both colors', () => {
    const { board } = parseBoard(`
      . . X O .
      o . X O x
      . . X . O
      . . X O .
      . . X O .
    `);
    const frozenBoard = deepFreeze(board);
    const dead = deepFreeze([{ x: 0, y: 3 }, 'e4']);
    const before = JSON.parse(JSON.stringify({ frozenBoard, dead }));
    const first = score(frozenBoard, { komi: 7.5, deadStones: dead });
    expect({ frozenBoard, dead }).toEqual(before);
    expect(first.ownership).not.toBe(frozenBoard.cells);
    // Mutating a result does not leak into the next call.
    (first.ownership as (Color | null)[])[0] = 'W';
    first.dame.length = 0;
    first.deadStones.push({ x: 4, y: 4 });
    const second = score(frozenBoard, { komi: 7.5, deadStones: dead });
    expect(second.ownership[0]).toBe('B');
    expect(names(second.deadStones, 5)).toEqual(['a4', 'e4']);
    expect(names(second.dame, 5)).toEqual(['d3']);
  });
});
