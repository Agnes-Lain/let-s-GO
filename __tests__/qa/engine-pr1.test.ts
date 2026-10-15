/**
 * QA (M1 PR 1): edge cases for spec docs/specs/M1-rules-engine.md §4 A and B (AC 1–10).
 * Every diagram below was checked by hand, point by point, before writing the expectation.
 */
import {
  BOARD_SIZES,
  createGame,
  EngineError,
  groupAt,
  isAtari,
  liberties,
  parseBoard,
  parseVertex,
  printBoard,
  toVertex,
  type Board,
  type BoardSize,
  type Color,
  type Point,
} from '@/engine';

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof EngineError ? error.code : 'not-an-engine-error';
  }
  return undefined;
}

function names(points: Point[] | null | undefined, size: BoardSize): string[] | null {
  return points ? points.map((p) => toVertex(p, size)) : null;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

function boardWith(size: BoardSize, black: string[], white: string[] = []): Board {
  return createGame(size, { setup: { B: black, W: white } }).board;
}

const LAST_COLUMN: Record<BoardSize, string> = { 5: 'e', 7: 'g', 9: 'j', 13: 'n', 19: 't' };

describe('QA AC 2/3: coordinates around skipped i and last column t', () => {
  it('AC 2: h and j are neighbours (no i) on 9, 13 and 19', () => {
    for (const size of [9, 13, 19] as BoardSize[]) {
      expect(parseVertex('h5', size)).toEqual({ x: 7, y: 4 });
      expect(parseVertex('j5', size)).toEqual({ x: 8, y: 4 });
      expect(toVertex({ x: 7, y: 0 }, size)).toBe('h1');
      expect(toVertex({ x: 8, y: 0 }, size)).toBe('j1');
    }
    expect(parseVertex('k1', 13)).toEqual({ x: 9, y: 0 });
    expect(parseVertex('n13', 13)).toEqual({ x: 12, y: 12 });
  });

  it('AC 2: 19x19 corners and the last column t', () => {
    expect(parseVertex('t1', 19)).toEqual({ x: 18, y: 0 });
    expect(parseVertex('a19', 19)).toEqual({ x: 0, y: 18 });
    expect(parseVertex('s19', 19)).toEqual({ x: 17, y: 18 });
    expect(toVertex({ x: 18, y: 0 }, 19)).toBe('t1');
    expect(toVertex({ x: 17, y: 18 }, 19)).toBe('s19');
  });

  it('AC 2: input is case-insensitive, output is lowercase', () => {
    expect(parseVertex('T19', 19)).toEqual({ x: 18, y: 18 });
    expect(parseVertex('J10', 19)).toEqual({ x: 8, y: 9 });
    expect(parseVertex('H8', 9)).toEqual({ x: 7, y: 7 });
    expect(toVertex(parseVertex('K10', 19), 19)).toBe('k10');
  });

  it('AC 2: no vertex on any board ever contains i; last column per size', () => {
    for (const size of BOARD_SIZES) {
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) expect(toVertex({ x, y }, size)).not.toMatch(/i/);
      }
      expect(toVertex({ x: size - 1, y: size - 1 }, size)).toBe(`${LAST_COLUMN[size]}${size}`);
    }
  });

  it('AC 3: i (any case), letters past the last column and rows past size are invalid', () => {
    const cases: [string, BoardSize][] = [
      ['I5', 19],
      ['i19', 19],
      ['u1', 19],
      ['a20', 19],
      ['t0', 19],
      ['o1', 13],
      ['a14', 13],
      ['k1', 9],
      ['h8', 7],
      ['g8', 7],
      ['f5', 5],
    ];
    for (const [vertex, size] of cases) {
      expect(errorCode(() => parseVertex(vertex, size))).toBe('invalid-vertex');
    }
  });

  it('AC 3: non-string input and non-integer points are rejected', () => {
    expect(errorCode(() => parseVertex(undefined as never, 9))).toBe('invalid-vertex');
    expect(errorCode(() => parseVertex(33 as never, 9))).toBe('invalid-vertex');
    expect(errorCode(() => groupAt(createGame(5).board, { x: 0.5, y: 0 }))).toBe('invalid-vertex');
    expect(errorCode(() => toVertex({ x: NaN, y: 0 }, 5))).toBe('invalid-vertex');
  });
});

describe('QA AC 7: liberties of single stones on every board size', () => {
  it.each(BOARD_SIZES)('%i: corners 2, edges 3, center 4', (size) => {
    const last = LAST_COLUMN[size];
    const mid = 'abcdefghjklmnopqrst'[(size - 1) / 2];
    const corners = ['a1', `a${size}`, `${last}1`, `${last}${size}`];
    for (const v of corners) {
      expect(liberties(boardWith(size, [v]), v)).toHaveLength(2);
    }
    const edges = [`a${(size + 1) / 2}`, `${mid}1`, `${mid}${size}`, `${last}${(size + 1) / 2}`];
    for (const v of edges) {
      expect(liberties(boardWith(size, [v]), v)).toHaveLength(3);
    }
    const center = `${mid}${(size + 1) / 2}`;
    expect(liberties(boardWith(size, [center]), center)).toHaveLength(4);
  });

  it('19x19 corner t19: liberties are s19 and t18', () => {
    expect(names(liberties(boardWith(19, ['t19']), 't19'), 19)).toEqual(['s19', 't18']);
  });

  it('13x13 corner n1 (white): liberties are m1 and n2', () => {
    expect(names(liberties(boardWith(13, [], ['n1']), 'n1'), 13)).toEqual(['m1', 'n2']);
  });
});

describe('QA AC 8/9: multi-stone groups', () => {
  it('a whole first line on 9x9: 9 stones, 9 liberties on line 2', () => {
    const row1 = 'abcdefghj'.split('').map((c) => `${c}1`);
    const board = boardWith(9, row1);
    const group = groupAt(board, 'e1');
    expect(names(group?.stones, 9)).toEqual(row1);
    expect(names(group?.liberties, 9)).toEqual(row1.map((v) => v.replace('1', '2')));
  });

  it('ring with an inner empty point: c3 touches 4 stones but is one liberty', () => {
    const { board } = parseBoard(`
      5 . . . . .
      4 . X X X .
      3 . X . X .
      2 . X X X .
      1 . . . . .
        a b c d e
    `);
    const group = groupAt(board, 'c4');
    expect(group?.stones).toHaveLength(8);
    expect(names(group?.liberties, 5)).toEqual([
      'a2',
      'a3',
      'a4',
      'b1',
      'b5',
      'c1',
      'c3',
      'c5',
      'd1',
      'd5',
      'e2',
      'e3',
      'e4',
    ]);
  });

  it('corner group around an eye at a2 (shared liberty counted once)', () => {
    const { board } = parseBoard(`
      5 . . . . .
      4 . . . . .
      3 X X . . .
      2 . X . . .
      1 X X . . .
        a b c d e
    `);
    const group = groupAt(board, 'a1');
    expect(names(group?.stones, 5)).toEqual(['a1', 'a3', 'b1', 'b2', 'b3']);
    expect(names(group?.liberties, 5)).toEqual(['a2', 'a4', 'b4', 'c1', 'c2', 'c3']);
    expect(groupAt(board, 'a3')).toEqual(group);
  });

  it('large irregular group on 9x9 next to a white stone; shared liberty g5', () => {
    const { board } = parseBoard(`
      9 . . . . . . . . .
      8 . X X X . . . . .
      7 . . . X . . . . .
      6 . . . X X X . . .
      5 . O . . . X . . .
      4 . . . . . X O . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . . . . . . . . .
        a b c d e f g h j
    `);
    const group = groupAt(board, 'b8');
    expect(names(group?.stones, 9)).toEqual(['b8', 'c8', 'd6', 'd7', 'd8', 'e6', 'f4', 'f5', 'f6']);
    // prettier-ignore
    expect(names(group?.liberties, 9)).toEqual([
      'a8', 'b7', 'b9', 'c6', 'c7', 'c9', 'd5', 'd9',
      'e4', 'e5', 'e7', 'e8', 'f3', 'f7', 'g5', 'g6',
    ]);
    expect(names(liberties(board, 'b5'), 9)).toEqual(['a5', 'b4', 'b6', 'c5']);
    expect(names(liberties(board, 'g4'), 9)).toEqual(['g3', 'g5', 'h4']);
  });

  it('diagonal-only chain is five separate groups', () => {
    const board = boardWith(5, ['a1', 'b2', 'c3', 'd4', 'e5']);
    for (const v of ['a1', 'b2', 'c3', 'd4', 'e5']) {
      expect(names(groupAt(board, v)?.stones, 5)).toEqual([v]);
    }
    expect(liberties(board, 'c3')).toHaveLength(4);
    expect(liberties(board, 'e5')).toHaveLength(2);
  });

  it('same-colour groups separated by an opponent stone stay separate', () => {
    // 1 X O X . .
    const board = boardWith(5, ['a1', 'c1'], ['b1']);
    expect(names(groupAt(board, 'a1')?.stones, 5)).toEqual(['a1']);
    expect(names(groupAt(board, 'a1')?.liberties, 5)).toEqual(['a2']);
    expect(names(groupAt(board, 'b1')?.liberties, 5)).toEqual(['b2']);
    expect(names(groupAt(board, 'c1')?.liberties, 5)).toEqual(['c2', 'd1']);
  });

  it('matches an independent flood-fill on pseudo-random boards of every size', () => {
    let seed = 12345;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (const size of BOARD_SIZES) {
      for (let round = 0; round < 5; round++) {
        const cells: (Color | null)[] = Array.from({ length: size * size }, () => {
          const r = rand();
          return r < 0.35 ? 'B' : r < 0.7 ? 'W' : null;
        });
        const board: Board = { size, cells };
        for (let i = 0; i < cells.length; i++) {
          const at = { x: i % size, y: Math.floor(i / size) };
          const expected = referenceGroup(board, at);
          const group = groupAt(board, at);
          if (expected === null) {
            expect(group).toBeNull();
          } else {
            expect(group?.stones.map(key)).toEqual(expected.stones);
            expect(group?.liberties.map(key)).toEqual(expected.liberties);
            expect(isAtari(board, at)).toBe(expected.liberties.length === 1);
          }
        }
      }
    }
  });
});

describe('QA AC 10: isAtari on multi-stone groups', () => {
  it('7x7 corner: three black stones with one liberty are in atari from any stone', () => {
    const { board } = parseBoard(`
      7 . . . . . . .
      6 . . . . . . .
      5 . . . . . . .
      4 . . . . . . .
      3 O O . . . . .
      2 X X O . . . .
      1 X . O . . . .
        a b c d e f g
    `);
    for (const v of ['a1', 'a2', 'b2']) {
      expect(isAtari(board, v)).toBe(true);
      expect(names(liberties(board, v), 7)).toEqual(['b1']);
    }
    // b3 and c2 only touch diagonally: two white groups
    expect(names(groupAt(board, 'a3')?.stones, 7)).toEqual(['a3', 'b3']);
    expect(names(liberties(board, 'a3'), 7)).toEqual(['a4', 'b4', 'c3']);
    expect(names(liberties(board, 'c1'), 7)).toEqual(['b1', 'c3', 'd1', 'd2']);
    expect(isAtari(board, 'a3')).toBe(false);
    expect(isAtari(board, 'c1')).toBe(false);
  });

  it('19x19 corner: t19+t18 in atari (only t17), white s19+s18 not', () => {
    const board = boardWith(19, ['t19', 't18'], ['s19', 's18']);
    expect(isAtari(board, 't19')).toBe(true);
    expect(names(liberties(board, 't18'), 19)).toEqual(['t17']);
    expect(isAtari(board, 's18')).toBe(false);
    expect(names(liberties(board, 's19'), 19)).toEqual(['r18', 'r19', 's17']);
  });

  it('two-stone edge group: atari with one liberty, not with two', () => {
    // 2 O . . . .
    // 1 X X O . .   a1 touches a2 (W); b1 touches b2 (empty) and c1 (W) -> only b2
    const board = boardWith(5, ['a1', 'b1'], ['a2', 'c1']);
    expect(names(liberties(board, 'a1'), 5)).toEqual(['b2']);
    expect(isAtari(board, 'a1')).toBe(true);
    const twoLibs = boardWith(5, ['a1', 'b1'], ['a2']);
    expect(names(liberties(twoLibs, 'b1'), 5)).toEqual(['b2', 'c1']);
    expect(isAtari(twoLibs, 'b1')).toBe(false);
  });
});

describe('QA AC 4/5: ASCII round-trips with markers', () => {
  it('19x19 with coords and markers in all four corners round-trips exactly', () => {
    const board = boardWith(19, ['a1', 't19', 'k10'], ['t1', 'a19']);
    const marked = [parseVertex('a1', 19), parseVertex('t1', 19)];
    const points = [parseVertex('a2', 19), parseVertex('s19', 19), parseVertex('j10', 19)];
    const text = printBoard(board, { coords: true, marked, points });
    const lines = text.split('\n');
    expect(lines).toHaveLength(20);
    const row = (n: number, cells: Record<number, string>) =>
      `${String(n).padStart(2)} ` + Array.from({ length: 19 }, (_, x) => cells[x] ?? '.').join(' ');
    expect(lines[0]).toBe(row(19, { 0: 'O', 17: '*', 18: 'X' }));
    expect(lines[9]).toBe(row(10, { 8: '*', 9: 'X' }));
    expect(lines[17]).toBe(row(2, { 0: '*' }));
    expect(lines[18]).toBe(row(1, { 0: 'x', 18: 'o' }));
    expect(lines[19]).toBe('   a b c d e f g h j k l m n o p q r s t');
    const parsed = parseBoard(text);
    expect(parsed.board).toEqual(board);
    expect(names(parsed.marked, 19)).toEqual(['a1', 't1']);
    expect(names(parsed.points, 19)).toEqual(['a2', 'j10', 's19']);
    expect(
      printBoard(parsed.board, { coords: true, marked: parsed.marked, points: parsed.points }),
    ).toBe(text);
  });

  it('13x13 canonical string with right-aligned row numbers round-trips', () => {
    const rows = Array.from({ length: 13 }, (_, i) => {
      const n = 13 - i;
      const cells = Array.from({ length: 13 }, () => '.');
      if (n === 9) cells[8] = 'X'; // j9
      if (n === 10) cells[7] = 'o'; // h10 marked white
      if (n === 1) cells[12] = '*'; // n1
      return `${String(n).padStart(2)} ${cells.join(' ')}`;
    });
    const text = [...rows, '   a b c d e f g h j k l m n'].join('\n');
    const parsed = parseBoard(text);
    expect(names(parsed.marked, 13)).toEqual(['h10']);
    expect(names(parsed.points, 13)).toEqual(['n1']);
    expect(parsed.board.cells[parseVertex('j9', 13).y * 13 + 8]).toBe('B');
    expect(
      printBoard(parsed.board, { coords: true, marked: parsed.marked, points: parsed.points }),
    ).toBe(text);
  });

  it('AC 4 board from createGame round-trips through parseBoard', () => {
    const state = createGame(5, { setup: { B: ['c3'], W: ['c2', 'b3', 'd3'] }, toPlay: 'W' });
    const text = printBoard(state.board, { coords: true });
    expect(parseBoard(text).board).toEqual(state.board);
    expect(text.endsWith('\n')).toBe(false);
  });

  it('a letter line containing i is rejected', () => {
    const text = ['. . . . . . . . .'].concat(Array(8).fill('. . . . . . . . .'));
    expect(errorCode(() => parseBoard([...text, 'a b c d e f g h i'].join('\n')))).toBe(
      'invalid-ascii',
    );
    expect(parseBoard([...text, 'a b c d e f g h j'].join('\n')).board.size).toBe(9);
  });
});

describe('QA purity: inputs are never mutated, outputs are fresh', () => {
  it('queries on a deep-frozen board do not throw and return fresh objects', () => {
    const board = deepFreeze(boardWith(5, ['b2', 'c2', 'c3'], ['d3']));
    const copy = JSON.parse(JSON.stringify(board));
    const g1 = groupAt(board, 'c3');
    expect(liberties(board, 'd3')).toHaveLength(3);
    expect(isAtari(board, 'b2')).toBe(false);
    printBoard(board, { coords: true, marked: deepFreeze([{ x: 1, y: 1 }]) });
    expect(board).toEqual(copy);
    g1?.stones.push({ x: 4, y: 4 });
    g1?.liberties.splice(0);
    expect(groupAt(board, 'c3')?.stones).toHaveLength(3);
    expect(groupAt(board, 'c3')?.liberties).toHaveLength(6);
  });

  it('createGame does not mutate deep-frozen options and is deterministic', () => {
    const opts = deepFreeze({
      setup: { B: ['c3', 'D4'], W: ['c2'] },
      toPlay: 'W' as const,
      komi: 2.5,
    });
    const copy = JSON.parse(JSON.stringify(opts));
    const a = createGame(5, opts);
    const b = createGame(5, opts);
    expect(opts).toEqual(copy);
    expect(a).toEqual(b);
    expect(a.board).not.toBe(b.board);
    expect(a.board.cells).not.toBe(b.board.cells);
  });

  it('two empty games do not share mutable state', () => {
    const a = createGame(9);
    const b = createGame(9);
    (a.board.cells as (Color | null)[])[0] = 'B';
    (a.captures as { B: number }).B = 3;
    expect(b.board.cells[0]).toBeNull();
    expect(b.captures.B).toBe(0);
    expect(createGame(9).board.cells[0]).toBeNull();
  });
});

function key(p: Point): string {
  return `${p.x},${p.y}`;
}

/** Simple recursive flood fill used as an oracle (different algorithm from the engine). */
function referenceGroup(board: Board, at: Point): { stones: string[]; liberties: string[] } | null {
  const { size, cells } = board;
  const color = cells[at.y * size + at.x];
  if (color === null) return null;
  const stones = new Set<string>();
  const libs = new Set<string>();
  const visit = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const c = cells[y * size + x];
    const k = `${x},${y}`;
    if (c === null) {
      libs.add(k);
    } else if (c === color && !stones.has(k)) {
      stones.add(k);
      visit(x + 1, y);
      visit(x - 1, y);
      visit(x, y + 1);
      visit(x, y - 1);
    }
  };
  visit(at.x, at.y);
  const sort = (s: Set<string>) =>
    [...s]
      .map((k) => k.split(',').map(Number))
      .sort((p, q) => p[0] - q[0] || p[1] - q[1])
      .map(([x, y]) => `${x},${y}`);
  return { stones: sort(stones), liberties: sort(libs) };
}
