// QA edge cases for M1 PR 2 (spec docs/specs/M1-rules-engine.md §4 C, D7, D8).
// Every diagram below was checked by hand: the liberties of each group are listed in a comment.

import {
  checkMove,
  createGame,
  legalMoves,
  parseBoard,
  pass,
  play,
  printBoard,
  toVertex,
  type BoardSize,
  type Color,
  type GameState,
  type Group,
  type IllegalReason,
  type MoveFacts,
  type Point,
  type Vertex,
} from './index';

// Helpers ---------------------------------------------------------------------------------------

function gameFrom(ascii: string, toPlay: Color): GameState {
  const { board } = parseBoard(ascii);
  const setup: { B: Vertex[]; W: Vertex[] } = { B: [], W: [] };
  board.cells.forEach((stone, index) => {
    if (stone === null) return;
    setup[stone].push(
      toVertex({ x: index % board.size, y: Math.floor(index / board.size) }, board.size),
    );
  });
  return createGame(board.size, { setup, toPlay });
}

function names(points: readonly Point[], size: BoardSize = 5): string[] {
  return points.map((p) => toVertex(p, size));
}

function groupNames(groups: readonly Group[], size: BoardSize = 5) {
  return groups.map((g) => ({
    stones: names(g.stones, size),
    liberties: names(g.liberties, size),
  }));
}

function playOk(state: GameState, at: Point | Vertex): { state: GameState; facts: MoveFacts } {
  const result = play(state, at);
  if (!result.ok) throw new Error(`expected ${JSON.stringify(at)} legal, got ${result.reason}`);
  return result;
}

function passOk(state: GameState): GameState {
  const result = pass(state);
  if (!result.ok) throw new Error('expected pass to be ok');
  return result.state;
}

function reasonOf(state: GameState, at: Point | Vertex): IllegalReason | null {
  const result = play(state, at);
  return result.ok ? null : result.reason;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

function rows(text: string): string {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n');
}

// Captures and self-atari -----------------------------------------------------------------------

describe('QA: capture by a move that is also self-atari', () => {
  // 4 . . O . .
  // 3 . O * O .     W c1+c2: only liberty c3. B b1+b2: a1, a2. B d1+d2: e1, e2.
  // 2 . X O X .     W b3: a3, b4. W d3: d4, e3. W c4: b4, c5, d4.
  // 1 . X O X .     B c3 captures 2 stones and is left with one liberty (c2): no ko.
  const BOARD = `
    5 . . . . .
    4 . . O . .
    3 . O . O .
    2 . X O X .
    1 . X O X .
  `;

  it('captures the 2-stone group, is self-atari, and is NOT a ko (2 stones captured)', () => {
    const { state, facts } = playOk(gameFrom(BOARD, 'B'), 'c3');
    expect(facts.captured.map((g) => names(g))).toEqual([['c1', 'c2']]);
    expect(names(facts.playedGroup.stones)).toEqual(['c3']);
    expect(names(facts.playedGroup.liberties)).toEqual(['c2']);
    expect(facts.selfAtari).toBe(true);
    expect(facts.koPoint).toBeNull();
    expect(state.koPoint).toBeNull();
    expect(state.captures).toEqual({ B: 2, W: 0 });
    expect(facts.opponentAtari).toEqual([]);
  });

  it('W may immediately take back at c2 (no ko ban), capturing c3', () => {
    const afterB = playOk(gameFrom(BOARD, 'B'), 'c3').state;
    expect(checkMove(afterB, 'c2')).toEqual({ legal: true });
    const { state, facts } = playOk(afterB, 'c2');
    expect(facts.captured.map((g) => names(g))).toEqual([['c3']]);
    // c2 then has c1 and c3: two liberties, so no ko either.
    expect(names(facts.playedGroup.liberties)).toEqual(['c1', 'c3']);
    expect(state.koPoint).toBeNull();
    expect(state.captures).toEqual({ B: 2, W: 1 });
  });
});

describe('QA: corner capture of 2 stones leaving the capturer with one liberty', () => {
  // 2 O X X . .     W b1+c1: only liberty a1. B b2+c2: b3, c3, d2. B d1: d2, e1.
  // 1 * O O X .     W a2: a1, a3.
  // B a1 captures b1+c1; a1 then has only b1 (a2 is W) -> self-atari, but 2 captured -> no ko.
  // W a2 is left with only a3 -> opponentAtari.
  const BOARD = `
    5 . . . . .
    4 . . . . .
    3 . . . . .
    2 O X X . .
    1 . O O X .
  `;

  it('captures [[b1, c1]], no ko point, self-atari, and puts W a2 in atari', () => {
    const { state, facts } = playOk(gameFrom(BOARD, 'B'), 'a1');
    expect(facts.captured.map((g) => names(g))).toEqual([['b1', 'c1']]);
    expect(names(facts.playedGroup.liberties)).toEqual(['b1']);
    expect(facts.selfAtari).toBe(true);
    expect(facts.koPoint).toBeNull();
    expect(state.koPoint).toBeNull();
    expect(groupNames(facts.opponentAtari)).toEqual([{ stones: ['a2'], liberties: ['a3'] }]);
    expect(printBoard(state.board)).toBe(
      rows(`
        . . . . .
        . . . . .
        . . . . .
        O X X . .
        X . . X .
      `),
    );
  });

  it('W b1 right away is legal (captures a1, not a ko retake)', () => {
    const afterB = playOk(gameFrom(BOARD, 'B'), 'a1').state;
    const { facts, state } = playOk(afterB, 'b1');
    expect(facts.captured.map((g) => names(g))).toEqual([['a1']]);
    expect(names(facts.playedGroup.liberties)).toEqual(['a1', 'c1']);
    expect(state.koPoint).toBeNull();
  });
});

describe('QA: capture that also puts another opponent group in atari', () => {
  // 2 . . * O X     W c1: only liberty c2. W d2: c2, d3. B b1: a1, b2. B d1: e1. B e2: e1, e3.
  // 1 . X O X .     B c2 captures c1; W d2 keeps only d3 -> opponentAtari.
  const BOARD = `
    5 . . . . .
    4 . . . . .
    3 . . . . .
    2 . . . O X
    1 . X O X .
  `;

  it('facts.captured = [[c1]] and facts.opponentAtari = [d2 with liberty d3]', () => {
    const { state, facts } = playOk(gameFrom(BOARD, 'B'), 'c2');
    expect(facts.captured.map((g) => names(g))).toEqual([['c1']]);
    expect(groupNames(facts.opponentAtari)).toEqual([{ stones: ['d2'], liberties: ['d3'] }]);
    expect(names(facts.playedGroup.liberties)).toEqual(['b2', 'c1', 'c3']);
    expect(facts.selfAtari).toBe(false);
    expect(state.koPoint).toBeNull();
  });
});

describe('QA: capturing a large group', () => {
  // 7×7. W a1–f1 + b2 (7 stones): a1 touches a2 X; b2 touches a2, c2, b3 X; c1–f1 touch row 2 X;
  // only liberty g1. B a2: a3. B c2–f2: c3–f3, g2. B b3: a3, b4, c3.
  const BOARD = `
    7 . . . . . . .
    6 . . . . . . .
    5 . . . . . . .
    4 . . . . . . .
    3 . X . . . . .
    2 X O X X X X .
    1 O O O O O O .
  `;

  it('B g1 captures all 7 stones as one group', () => {
    const { state, facts } = playOk(gameFrom(BOARD, 'B'), 'g1');
    expect(facts.captured.map((g) => names(g, 7))).toEqual([
      ['a1', 'b1', 'b2', 'c1', 'd1', 'e1', 'f1'],
    ]);
    expect(state.captures).toEqual({ B: 7, W: 0 });
    expect(state.koPoint).toBeNull();
    expect(state.board.cells.filter((c) => c === 'W')).toHaveLength(0);
    expect(names(facts.playedGroup.liberties, 7)).toEqual(['f1', 'g2']);
  });
});

// Suicide ---------------------------------------------------------------------------------------

describe('QA: filling an eye', () => {
  it('filling the last eye is suicide; the opponent may play there and capture', () => {
    // 3 O O . . .    B a2+b2+b1: only liberty a1. W a3+b3: a4, b4, c3. W c1+c2: c3, d1, d2.
    // 2 X X O . .
    // 1 * X O . .
    const state = gameFrom(
      `
      5 . . . . .
      4 . . . . .
      3 O O . . .
      2 X X O . .
      1 . X O . .
      `,
      'B',
    );
    expect(reasonOf(state, 'a1')).toBe('suicide');
    expect(checkMove(state, 'a1')).toEqual({ legal: false, reason: 'suicide' });
    expect(names(legalMoves(state))).not.toContain('a1');

    const asWhite = { ...state, toPlay: 'W' as const };
    const { facts } = playOk(asWhite, 'a1');
    expect(facts.captured.map((g) => names(g))).toEqual([['a2', 'b1', 'b2']]);
  });

  it('filling one of two eyes is legal self-atari; then W captures the whole group', () => {
    // 3 O O O O O    B a2–d2 + b1 + d1: liberties a1, c1 (two eyes).
    // 2 X X X X O    W row 3 + e2 + e1: liberties a4–e4.
    // 1 . X . X O
    const state = gameFrom(
      `
      5 . . . . .
      4 . . . . .
      3 O O O O O
      2 X X X X O
      1 . X . X O
      `,
      'B',
    );
    // Before: W cannot play inside either eye.
    const asWhite = { ...state, toPlay: 'W' as const };
    expect(checkMove(asWhite, 'a1')).toEqual({ legal: false, reason: 'suicide' });
    expect(checkMove(asWhite, 'c1')).toEqual({ legal: false, reason: 'suicide' });

    const filled = playOk(state, 'c1');
    expect(filled.facts.captured).toEqual([]);
    expect(filled.facts.selfAtari).toBe(true);
    expect(names(filled.facts.playedGroup.liberties)).toEqual(['a1']);
    expect(filled.facts.playedGroup.stones).toHaveLength(7);

    const { state: next, facts } = playOk(filled.state, 'a1');
    expect(facts.captured.map((g) => names(g))).toEqual([
      ['a2', 'b1', 'b2', 'c1', 'c2', 'd1', 'd2'],
    ]);
    expect(next.captures.W).toBe(7);
    expect(next.koPoint).toBeNull();
  });
});

describe('QA: suicide on a 19×19 edge', () => {
  it('a single stone on the bottom edge with no liberties and no capture is suicide', () => {
    // W h1, k1, j2 surround j1 (columns skip i). Each W stone keeps liberties.
    const state = createGame(19, { setup: { W: ['h1', 'k1', 'j2'] } });
    expect(reasonOf(state, 'j1')).toBe('suicide');
    expect(checkMove(state, { x: 8, y: 0 })).toEqual({ legal: false, reason: 'suicide' });
    expect(names(legalMoves(state), 19)).not.toContain('j1');
    expect(legalMoves(state)).toHaveLength(361 - 3 - 1);
  });

  it('joining a friendly edge stone that has only this liberty is suicide', () => {
    // B h1 (only liberty j1); W g1 (f1, g2), W h2+j2 (g2, h3, j3, k2), W k1 (k2, l1).
    const state = createGame(19, { setup: { B: ['h1'], W: ['g1', 'h2', 'j2', 'k1'] } });
    expect(reasonOf(state, 'j1')).toBe('suicide');
  });

  it('on the top-right corner t19 is suicide when s19 and t18 are W', () => {
    const state = createGame(19, { setup: { W: ['s19', 't18'] } });
    expect(reasonOf(state, 't19')).toBe('suicide');
    expect(reasonOf(state, { x: 18, y: 18 })).toBe('suicide');
  });
});

// Ko --------------------------------------------------------------------------------------------

describe('QA: ko on the edge', () => {
  // 2 . X O . .    W b1: only liberty c1. B a1: a2. B b2: a2, b3. W c2: c3, d2. W d1: e1, d2.
  // 1 X O * O .    B c1 captures b1 and keeps only b1 -> ko at b1.
  const BOARD = `
    5 . . . . .
    4 . . . . .
    3 . . . . .
    2 . X O . .
    1 X O . O .
  `;

  it('B c1 creates a ko at b1; W b1 is ko; after two moves elsewhere W retakes', () => {
    const take = playOk(gameFrom(BOARD, 'B'), 'c1');
    expect(take.facts.captured.map((g) => names(g))).toEqual([['b1']]);
    expect(take.facts.selfAtari).toBe(true);
    expect(names([take.state.koPoint as Point])).toEqual(['b1']);
    expect(reasonOf(take.state, 'b1')).toBe('ko');
    expect(names(legalMoves(take.state))).not.toContain('b1');

    const later = playOk(playOk(take.state, 'e5').state, 'a5').state;
    expect(later.koPoint).toBeNull();
    const retake = playOk(later, 'b1');
    expect(retake.facts.captured.map((g) => names(g))).toEqual([['c1']]);
    expect(names([retake.state.koPoint as Point])).toEqual(['c1']);
    expect(reasonOf(retake.state, 'c1')).toBe('ko');
  });
});

describe('QA: ko in the corner', () => {
  // 2 X O . . .    B b1: only liberty a1. B a2: a1, a3. W b2: b3, c2. W c1: c2, d1.
  // 1 * X O . .    W a1 captures b1, keeps only b1 -> ko at b1; B a2 left with a3 only.
  const BOARD = `
    5 . . . . .
    4 . . . . .
    3 . . . . .
    2 X O . . .
    1 . X O . .
  `;

  it('W a1 takes the corner ko and puts a2 in atari; B b1 is ko', () => {
    const take = playOk(gameFrom(BOARD, 'W'), 'a1');
    expect(take.facts.captured.map((g) => names(g))).toEqual([['b1']]);
    expect(take.facts.koPoint).toEqual({ x: 1, y: 0 });
    expect(take.facts.selfAtari).toBe(true);
    expect(groupNames(take.facts.opponentAtari)).toEqual([{ stones: ['a2'], liberties: ['a3'] }]);
    expect(reasonOf(take.state, 'b1')).toBe('ko');
    expect(checkMove(take.state, 'b1')).toEqual({ legal: false, reason: 'ko' });
  });

  it('after the ko is resolved elsewhere B may retake in the corner', () => {
    const take = playOk(gameFrom(BOARD, 'W'), 'a1').state;
    const later = playOk(playOk(take, 'e5').state, 'e4').state;
    const retake = playOk(later, 'b1');
    expect(retake.facts.captured.map((g) => names(g))).toEqual([['a1']]);
    // b1 now has a1 only (b2, c1 W): ko for W at a1.
    expect(retake.state.koPoint).toEqual({ x: 0, y: 0 });
  });
});

describe('QA: ko ban lasts exactly one turn (D8)', () => {
  // AC 21 shape.
  const KO = `
    5 . . . . .
    4 . . X O .
    3 . X O . O
    2 . . X O .
    1 . . . . .
  `;
  const taken = () => playOk(gameFrom(KO, 'B'), 'd3').state;

  it('the banned player (W) plays elsewhere: the ban is gone, so B may fill the ko at c3', () => {
    const afterW = playOk(taken(), 'a1').state;
    expect(afterW.koPoint).toBeNull();
    expect(checkMove(afterW, 'c3')).toEqual({ legal: true });
    const { facts } = playOk(afterW, 'c3');
    expect(facts.captured).toEqual([]);
    expect(names(facts.playedGroup.stones)).toEqual(['b3', 'c2', 'c3', 'c4', 'd3']);
  });

  it('the ban does not come back for W after B plays elsewhere', () => {
    const s = playOk(playOk(taken(), 'a1').state, 'e1').state;
    expect(s.koPoint).toBeNull();
    expect(checkMove(s, 'c3')).toEqual({ legal: true });
  });

  it('W plays elsewhere and B passes: W may retake', () => {
    const s = passOk(playOk(taken(), 'a1').state);
    expect(s.koPoint).toBeNull();
    expect(s.toPlay).toBe('W');
    expect(playOk(s, 'c3').facts.captured.map((g) => names(g))).toEqual([['d3']]);
  });

  it('a non-capturing move never sets a ko point', () => {
    const { facts, state } = playOk(taken(), 'a1');
    expect(facts.koPoint).toBeNull();
    expect(state.koPoint).toBeNull();
  });
});

describe('QA: a second ko right after the first', () => {
  // 9×9. Ko A (B takes at d3, capturing W c3): B c4, b3, c2; W c3, d4, e3, d2.
  //   W c3: only d3. After B d3: d3 has only c3 (d4, e3, d2 W with ≥2 liberties).
  // Ko B (W takes at d7, capturing B c7): W c8, b7, c6; B c7, d8, e7, d6.
  //   B c7: only d7. After W d7: d7 has only c7 (d8, e7, d6 B with ≥2 liberties).
  const BOARD = `
    9 . . . . . . . . .
    8 . . O X . . . . .
    7 . O X . X . . . .
    6 . . O X . . . . .
    5 . . . . . . . . .
    4 . . X O . . . . .
    3 . X O . O . . . .
    2 . . X O . . . . .
    1 . . . . . . . . .
  `;

  it('W, banned at c3, takes the other ko; bans move with each turn', () => {
    const start = gameFrom(BOARD, 'B');
    const b1 = playOk(start, 'd3');
    expect(names([b1.state.koPoint as Point], 9)).toEqual(['c3']);
    expect(reasonOf(b1.state, 'c3')).toBe('ko');

    const w1 = playOk(b1.state, 'd7');
    expect(w1.facts.captured.map((g) => names(g, 9))).toEqual([['c7']]);
    expect(names([w1.state.koPoint as Point], 9)).toEqual(['c7']);
    expect(reasonOf(w1.state, 'c7')).toBe('ko');
    // B is not banned at c3 (it is W's ko point, and expired anyway): filling it is legal.
    expect(checkMove(w1.state, 'c3')).toEqual({ legal: true });

    const b2 = playOk(w1.state, 'j1'); // B elsewhere
    expect(b2.state.koPoint).toBeNull();
    const w2 = playOk(b2.state, 'c3'); // W retakes ko A
    expect(w2.facts.captured.map((g) => names(g, 9))).toEqual([['d3']]);
    expect(names([w2.state.koPoint as Point], 9)).toEqual(['d3']);
    // B's ban at c7 has expired: B retakes ko B.
    const b3 = playOk(w2.state, 'c7');
    expect(b3.facts.captured.map((g) => names(g, 9))).toEqual([['d7']]);
    expect(names([b3.state.koPoint as Point], 9)).toEqual(['d7']);
    expect(checkMove(b3.state, 'd3')).toEqual({ legal: true }); // W may connect at d3
    expect(reasonOf(b3.state, 'd7')).toBe('ko');
    expect(b3.state.captures).toEqual({ B: 2, W: 2 });
  });
});

// Counters and history --------------------------------------------------------------------------

describe('QA: captures accumulate and the move history is exact', () => {
  const KO = `
    5 . . . . .
    4 . . X O .
    3 . X O . O
    2 . . X O .
    1 . . . . .
  `;

  it('fight the ko three times; counters and moves track every step', () => {
    let s = gameFrom(KO, 'B');
    const seq: [Vertex | 'pass', Color, number, number][] = [
      ['d3', 'B', 1, 0],
      ['a1', 'W', 1, 0],
      ['e1', 'B', 1, 0],
      ['c3', 'W', 1, 1],
      ['a5', 'B', 1, 1],
      ['pass', 'W', 1, 1],
      ['d3', 'B', 2, 1],
    ];
    for (const [move, color, capB, capW] of seq) {
      expect(s.toPlay).toBe(color);
      s = move === 'pass' ? passOk(s) : playOk(s, move).state;
      expect(s.captures).toEqual({ B: capB, W: capW });
    }
    // Illegal attempts are not recorded.
    expect(reasonOf(s, 'c3')).toBe('ko');
    expect(reasonOf(s, 'd3')).toBe('occupied');
    expect(s.moves).toEqual([
      { type: 'play', color: 'B', point: { x: 3, y: 2 } },
      { type: 'play', color: 'W', point: { x: 0, y: 0 } },
      { type: 'play', color: 'B', point: { x: 4, y: 0 } },
      { type: 'play', color: 'W', point: { x: 2, y: 2 } },
      { type: 'play', color: 'B', point: { x: 0, y: 4 } },
      { type: 'pass', color: 'W' },
      { type: 'play', color: 'B', point: { x: 3, y: 2 } },
    ]);
    expect(s.moves).toHaveLength(7);
    expect(s.consecutivePasses).toBe(0);
  });

  it('a game set up with W to play records W first', () => {
    const s = playOk(createGame(5, { toPlay: 'W' }), 'c3').state;
    expect(s.moves).toEqual([{ type: 'play', color: 'W', point: { x: 2, y: 2 } }]);
    expect(s.board.cells[2 * 5 + 2]).toBe('W');
  });

  it('the history point is a copy of the caller point (mutating the input does not leak)', () => {
    const at = { x: 1, y: 1 };
    const s = playOk(createGame(5), at).state;
    at.x = 4;
    expect(s.moves[0]).toEqual({ type: 'play', color: 'B', point: { x: 1, y: 1 } });
  });
});

describe('QA: two passes end the game (AC 26)', () => {
  it('two passes count to 2 and end the game; game-over is checked before off-board', () => {
    const s = passOk(passOk(createGame(5)));
    expect(s.consecutivePasses).toBe(2);
    expect(s.isOver).toBe(true);
    expect(s.moves).toEqual([
      { type: 'pass', color: 'B' },
      { type: 'pass', color: 'W' },
    ]);
    expect(reasonOf(s, { x: 99, y: 99 })).toBe('game-over'); // game-over is checked first
    expect(reasonOf(s, 'c3')).toBe('game-over');
  });
});

describe('QA: check order', () => {
  it('occupied wins over ko and suicide; off-board for non-integer and NaN points', () => {
    const s = createGame(5, { setup: { B: ['c3'] }, toPlay: 'W' });
    expect(reasonOf(s, 'c3')).toBe('occupied');
    expect(reasonOf(s, { x: 2.5, y: 2 })).toBe('off-board');
    expect(reasonOf(s, { x: Number.NaN, y: 0 })).toBe('off-board');
    expect(reasonOf(s, { x: 0, y: 5 })).toBe('off-board');
  });
});

// Purity ----------------------------------------------------------------------------------------

describe('QA: purity with deep-frozen states through a whole game', () => {
  it('every state and fact can be deep-frozen and play continues from frozen results', () => {
    let s = deepFreeze(createGame(9));
    for (let i = 0; i < 200; i++) {
      const moves = legalMoves(s);
      const snapshot = JSON.stringify(s);
      if (moves.length === 0) {
        s = deepFreeze(passOk(s));
        continue;
      }
      const result = play(s, moves[(13 * i + 5) % moves.length]);
      if (!result.ok) throw new Error(result.reason);
      expect(JSON.stringify(s)).toBe(snapshot);
      deepFreeze(result.facts);
      s = deepFreeze(result.state);
    }
    expect(s.moves).toHaveLength(200);
  });
});

// Reference model: legalMoves / checkMove / play vs. an independent implementation ----------------

/** Tiny seeded PRNG (mulberry32), test-only. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Cells = (Color | null)[];

/**
 * Independent rules model. Ko is defined by position repetition: a move is a ko violation when
 * the previous move was a play and this move would recreate the board from before that play.
 */
class Reference {
  cells: Cells;
  toPlay: Color;
  previousBoard: string | null = null; // board before the last move, null after a pass
  captures = { B: 0, W: 0 };
  passesInARow = 0; // two in a row end the game (AC 26)
  constructor(
    readonly size: number,
    toPlay: Color,
  ) {
    this.cells = Array<Color | null>(size * size).fill(null);
    this.toPlay = toPlay;
  }

  private chain(cells: Cells, start: number): { stones: number[]; libs: Set<number> } {
    const color = cells[start];
    const stones = [start];
    const seen = new Set([start]);
    const libs = new Set<number>();
    for (let i = 0; i < stones.length; i++) {
      const p = stones[i];
      const x = p % this.size;
      const y = Math.floor(p / this.size);
      const ns: number[] = [];
      if (x > 0) ns.push(p - 1);
      if (x < this.size - 1) ns.push(p + 1);
      if (y > 0) ns.push(p - this.size);
      if (y < this.size - 1) ns.push(p + this.size);
      for (const n of ns) {
        if (cells[n] === null) libs.add(n);
        else if (cells[n] === color && !seen.has(n)) {
          seen.add(n);
          stones.push(n);
        }
      }
    }
    return { stones, libs };
  }

  /** Returns the resulting cells + capture count, or the reason the move is illegal. */
  attempt(index: number): { cells: Cells; captured: number } | IllegalReason {
    if (this.cells[index] !== null) return 'occupied';
    const me = this.toPlay;
    const opp: Color = me === 'B' ? 'W' : 'B';
    const cells = [...this.cells];
    cells[index] = me;
    let captured = 0;
    for (let p = 0; p < cells.length; p++) {
      if (cells[p] !== opp) continue;
      const { stones, libs } = this.chain(cells, p);
      if (libs.size === 0) {
        for (const s of stones) cells[s] = null;
        captured += stones.length;
      }
    }
    if (this.chain(cells, index).libs.size === 0) return 'suicide';
    if (this.previousBoard !== null && cells.join() === this.previousBoard) return 'ko';
    return { cells, captured };
  }

  commitPlay(index: number): void {
    const r = this.attempt(index);
    if (typeof r === 'string') throw new Error(`reference refused ${index}: ${r}`);
    this.previousBoard = this.cells.join();
    this.cells = r.cells;
    this.captures[this.toPlay] += r.captured;
    this.passesInARow = 0;
    this.toPlay = this.toPlay === 'B' ? 'W' : 'B';
  }

  commitPass(): void {
    this.previousBoard = null;
    this.passesInARow++;
    this.toPlay = this.toPlay === 'B' ? 'W' : 'B';
  }
}

describe('QA: engine agrees with an independent reference on seeded random games', () => {
  const sizes: BoardSize[] = [5, 7, 9];
  const reasonsSeen = new Set<string>();

  for (const size of sizes) {
    it(`size ${size}: legalMoves, checkMove and play match the reference for 3 × 150 turns`, () => {
      const rand = mulberry32(0xc0ffee + size);
      for (let game = 0; game < 3; game++) {
        let s = createGame(size);
        let ref = new Reference(size, 'B');
        for (let turn = 0; turn < 150; turn++) {
          // 0. Two passes in a row end the game (AC 26): the engine agrees, then start over.
          expect(s.isOver).toBe(ref.passesInARow >= 2);
          if (s.isOver) {
            s = createGame(size);
            ref = new Reference(size, 'B');
          }
          // 1. Every point: checkMove vs reference, and legalMoves = the legal ones, sorted.
          const expectedLegal: Point[] = [];
          for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
              const r = ref.attempt(y * size + x);
              const expected =
                typeof r === 'string' ? { legal: false, reason: r } : { legal: true };
              expect(checkMove(s, { x, y })).toEqual(expected);
              if (typeof r === 'string') reasonsSeen.add(r);
              else expectedLegal.push({ x, y });
            }
          }
          expect(legalMoves(s)).toEqual(expectedLegal);

          // 2. Pick a random point (legal or not) or pass now and then.
          if (rand() < 0.04 || expectedLegal.length === 0) {
            s = passOk(s);
            ref.commitPass();
            continue;
          }
          const index = Math.floor(rand() * size * size);
          const point = { x: index % size, y: Math.floor(index / size) };
          const refResult = ref.attempt(index);
          const result = play(s, point);
          if (typeof refResult === 'string') {
            expect(result).toEqual({ ok: false, reason: refResult });
            continue;
          }
          if (!result.ok) throw new Error(`engine refused a legal move: ${result.reason}`);
          ref.commitPlay(index);
          expect(result.state.board.cells).toEqual(ref.cells);
          expect(result.state.captures).toEqual(ref.captures);
          expect(result.state.toPlay).toBe(ref.toPlay);
          expect(result.facts.captured.flat()).toHaveLength(refResult.captured);
          expect(result.state.moves[result.state.moves.length - 1]).toEqual({
            type: 'play',
            color: result.facts.color,
            point,
          });
          s = result.state;
        }
      }
    });
  }

  it('the random games exercised every illegal reason', () => {
    expect([...reasonsSeen].sort()).toEqual(['ko', 'occupied', 'suicide']);
  });
});

describe('missing point input', () => {
  it('play and checkMove reject null/undefined with EngineError invalid-vertex', () => {
    const s = createGame(5);
    for (const bad of [null, undefined, 3]) {
      expect(() => play(s, bad as never)).toThrow(
        expect.objectContaining({ code: 'invalid-vertex' }),
      );
      expect(() => checkMove(s, bad as never)).toThrow(
        expect.objectContaining({ code: 'invalid-vertex' }),
      );
    }
  });
});
