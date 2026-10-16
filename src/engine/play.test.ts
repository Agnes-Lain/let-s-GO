import {
  checkMove,
  createGame,
  EngineError,
  legalMoves,
  parseBoard,
  pass,
  play,
  printBoard,
  toVertex,
  type Color,
  type GameState,
  type Group,
  type MoveFacts,
  type PlayResult,
  type Point,
  type Vertex,
} from './index';

// Helpers ---------------------------------------------------------------------------------------

/** A game whose setup stones come from an ASCII diagram (validated by createGame). */
function gameFrom(ascii: string, toPlay: Color): GameState {
  const { board } = parseBoard(ascii);
  const setup: { B: Vertex[]; W: Vertex[] } = { B: [], W: [] };
  board.cells.forEach((stone, index) => {
    if (stone === null) return;
    const point = { x: index % board.size, y: Math.floor(index / board.size) };
    setup[stone].push(toVertex(point, board.size));
  });
  return createGame(board.size, { setup, toPlay });
}

function names(points: readonly Point[]): string[] {
  return points.map((p) => toVertex(p, 5));
}

function groupNames(groups: readonly Group[]): { stones: string[]; liberties: string[] }[] {
  return groups.map((g) => ({ stones: names(g.stones), liberties: names(g.liberties) }));
}

function show(state: GameState): string {
  return printBoard(state.board, { coords: true });
}

/** Plays a legal move and returns the new state and facts; fails the test on an illegal move. */
function playOk(state: GameState, at: Point | Vertex): { state: GameState; facts: MoveFacts } {
  const result = play(state, at);
  if (!result.ok)
    throw new Error(`expected ${JSON.stringify(at)} to be legal, got ${result.reason}`);
  return result;
}

function reasonOf(result: PlayResult): string | null {
  return result.ok ? null : result.reason;
}

function diagram(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .replace(/^a/m, '  a');
}

const EMPTY_5 = `
  5 . . . . .
  4 . . . . .
  3 . . . . .
  2 . . . . .
  1 . . . . .
    a b c d e
`;

// C. Legality & captures ------------------------------------------------------------------------

describe('turn order', () => {
  it('AC 11: B then W, toPlay alternates and moves are recorded', () => {
    const start = createGame(5);
    const afterB = playOk(start, 'c3').state;
    expect(afterB.toPlay).toBe('W');
    const afterW = playOk(afterB, 'd3').state;
    expect(afterW.toPlay).toBe('B');
    expect(afterW.moves).toEqual([
      { type: 'play', color: 'B', point: { x: 2, y: 2 } },
      { type: 'play', color: 'W', point: { x: 3, y: 2 } },
    ]);
  });

  it('AC 11: an illegal attempt returns ok false and leaves the state unchanged', () => {
    const state = playOk(createGame(5), 'c3').state;
    const before = JSON.parse(JSON.stringify(state));
    const result = play(state, 'c3');
    expect(result.ok).toBe(false);
    expect(state.toPlay).toBe('W');
    expect(state).toEqual(before);
  });

  it('AC 11: the facts name the color and point of the move', () => {
    const { facts } = playOk(createGame(5), { x: 2, y: 2 });
    expect(facts.color).toBe('B');
    expect(facts.point).toEqual({ x: 2, y: 2 });
  });
});

describe('occupied and off-board', () => {
  it('AC 12: playing on a stone is occupied', () => {
    const state = gameFrom(EMPTY_5.replace('3 . . . . .', '3 . . X . .'), 'W');
    expect(reasonOf(play(state, 'c3'))).toBe('occupied');
    expect(checkMove(state, 'c3')).toEqual({ legal: false, reason: 'occupied' });
  });

  it('AC 12: a Point outside the board is off-board', () => {
    const state = createGame(5);
    expect(reasonOf(play(state, { x: 5, y: 0 }))).toBe('off-board');
    expect(reasonOf(play(state, { x: 0, y: -1 }))).toBe('off-board');
    expect(reasonOf(play(state, { x: 1.5, y: 0 }))).toBe('off-board');
    expect(checkMove(state, { x: 5, y: 0 })).toEqual({ legal: false, reason: 'off-board' });
  });

  it('AC 12: a malformed vertex string is a content error and throws invalid-vertex', () => {
    const state = createGame(5);
    expect(() => play(state, 'f1')).toThrow(EngineError);
    expect(() => checkMove(state, 'z9')).toThrow(EngineError);
  });
});

describe('captures', () => {
  it('AC 13: capture in the center', () => {
    const state = createGame(5, { setup: { B: ['c3'], W: ['c2', 'b3', 'd3'] }, toPlay: 'W' });
    const { state: next, facts } = playOk(state, 'c4');
    expect(show(next)).toBe(
      diagram(`
        5 . . . . .
        4 . . O . .
        3 . O . O .
        2 . . O . .
        1 . . . . .
        a b c d e
      `),
    );
    expect(facts.captured.map(names)).toEqual([['c3']]);
    expect(next.captures).toEqual({ B: 0, W: 1 });
    expect(next.koPoint).toBeNull();
    expect(facts.koPoint).toBeNull();
  });

  it('AC 14: capture on the edge', () => {
    const state = createGame(5, { setup: { B: ['c1'], W: ['b1', 'd1'] }, toPlay: 'W' });
    const { state: next, facts } = playOk(state, 'c2');
    expect(next.board.cells[2]).toBeNull(); // c1
    expect(facts.captured.map(names)).toEqual([['c1']]);
    expect(next.captures.W).toBe(1);
  });

  it('AC 15: capture in the corner', () => {
    const state = createGame(5, { setup: { B: ['a1'], W: ['b1'] }, toPlay: 'W' });
    const { state: next, facts } = playOk(state, 'a2');
    expect(next.board.cells[0]).toBeNull(); // a1
    expect(facts.captured.map(names)).toEqual([['a1']]);
    expect(next.captures.W).toBe(1);
  });

  it('AC 16: capture a 2-stone group', () => {
    const state = createGame(5, {
      setup: { B: ['b1', 'c1'], W: ['a1', 'b2', 'd1'] },
      toPlay: 'W',
    });
    const { state: next, facts } = playOk(state, 'c2');
    expect(show(next)).toBe(
      diagram(`
        5 . . . . .
        4 . . . . .
        3 . . . . .
        2 . O O . .
        1 O . . O .
        a b c d e
      `),
    );
    expect(facts.captured.map(names)).toEqual([['b1', 'c1']]);
    expect(next.captures).toEqual({ B: 0, W: 2 });
  });

  it('AC 17: one move captures two groups (not a ko)', () => {
    const state = gameFrom(
      `
      5 . . . . .
      4 . . . . .
      3 . . . . .
      2 . O . O .
      1 O X . X O
        a b c d e
      `,
      'W',
    );
    const { state: next, facts } = playOk(state, 'c1');
    expect(facts.captured.map(names)).toEqual([['b1'], ['d1']]);
    expect(next.captures.W).toBe(2);
    expect(names(facts.playedGroup.stones)).toEqual(['c1']);
    expect(names(facts.playedGroup.liberties)).toEqual(['b1', 'c2', 'd1']);
    expect(next.koPoint).toBeNull();
    expect(facts.koPoint).toBeNull();
  });
});

describe('suicide (禁入点 jìnrùdiǎn)', () => {
  it('AC 18: a single stone in the corner with no liberties is suicide', () => {
    const state = createGame(5, { setup: { W: ['a2', 'b1'] }, toPlay: 'B' });
    expect(reasonOf(play(state, 'a1'))).toBe('suicide');
    expect(checkMove(state, 'a1')).toEqual({ legal: false, reason: 'suicide' });
  });

  it('AC 18: a single stone in the center with no liberties is suicide', () => {
    const state = createGame(5, { setup: { W: ['b3', 'c2', 'c4', 'd3'] }, toPlay: 'B' });
    expect(reasonOf(play(state, 'c3'))).toBe('suicide');
    expect(checkMove(state, 'c3')).toEqual({ legal: false, reason: 'suicide' });
  });

  it('AC 19: a move that leaves its own group with no liberties is suicide', () => {
    const state = gameFrom(
      `
      5 . . . . .
      4 . . . . .
      3 . . . . .
      2 O O . . .
      1 X . O . .
        a b c d e
      `,
      'B',
    );
    const before = JSON.parse(JSON.stringify(state));
    expect(reasonOf(play(state, 'b1'))).toBe('suicide');
    expect(checkMove(state, 'b1')).toEqual({ legal: false, reason: 'suicide' });
    expect(state).toEqual(before);
    expect(names(legalMoves(state))).not.toContain('b1');
  });

  it('AC 20: looks like suicide but captures, so it is legal', () => {
    const state = gameFrom(
      `
      5 . . . . .
      4 . . . . .
      3 X . . . .
      2 O X . . .
      1 . O X . .
        a b c d e
      `,
      'B',
    );
    expect(checkMove(state, 'a1')).toEqual({ legal: true });
    const { state: next, facts } = playOk(state, 'a1');
    expect(facts.captured.map(names)).toEqual([['a2'], ['b1']]);
    expect(next.captures).toEqual({ B: 2, W: 0 });
    expect(names(facts.playedGroup.stones)).toEqual(['a1']);
    expect(names(facts.playedGroup.liberties)).toEqual(['a2', 'b1']);
    expect(facts.selfAtari).toBe(false);
    expect(next.koPoint).toBeNull();
    expect(facts.koPoint).toBeNull();
  });
});

describe('ko (打劫 dǎjié)', () => {
  const KO = `
    5 . . . . .
    4 . . X O .
    3 . X O . O
    2 . . X O .
    1 . . . . .
      a b c d e
  `;

  function afterBlackTakesKo() {
    return playOk(gameFrom(KO, 'B'), 'd3');
  }

  it('AC 21: B d3 captures c3, creates the ko point c3 and is self-atari', () => {
    const { state, facts } = afterBlackTakesKo();
    expect(show(state)).toBe(
      diagram(`
        5 . . . . .
        4 . . X O .
        3 . X . X O
        2 . . X O .
        1 . . . . .
        a b c d e
      `),
    );
    expect(facts.captured.map(names)).toEqual([['c3']]);
    expect(facts.selfAtari).toBe(true);
    expect(names(facts.playedGroup.liberties)).toEqual(['c3']);
    expect(facts.koPoint).toEqual({ x: 2, y: 2 });
    expect(state.koPoint).toEqual({ x: 2, y: 2 });
    expect(facts.opponentAtari).toEqual([]);
  });

  it('AC 21: W cannot retake at c3 right away; board and turn unchanged', () => {
    const { state } = afterBlackTakesKo();
    const before = JSON.parse(JSON.stringify(state));
    expect(reasonOf(play(state, 'c3'))).toBe('ko');
    expect(reasonOf(play(state, { x: 2, y: 2 }))).toBe('ko');
    expect(checkMove(state, 'c3')).toEqual({ legal: false, reason: 'ko' });
    expect(state).toEqual(before);
    expect(state.toPlay).toBe('W');
  });

  it('AC 21: legalMoves excludes the ko point', () => {
    const { state } = afterBlackTakesKo();
    const moves = legalMoves(state).map((p) => toVertex(p, 5));
    expect(moves).not.toContain('c3');
    expect(moves).toContain('a1');
  });

  it('AC 22: after W a1 and B e1, W retakes at c3 and the new ko point is d3', () => {
    let { state } = afterBlackTakesKo();
    state = playOk(state, 'a1').state;
    expect(state.koPoint).toBeNull();
    state = playOk(state, 'e1').state;
    expect(checkMove(state, 'c3')).toEqual({ legal: true });
    const { state: next, facts } = playOk(state, 'c3');
    expect(facts.captured.map(names)).toEqual([['d3']]);
    expect(facts.koPoint).toEqual({ x: 3, y: 2 });
    expect(next.koPoint).toEqual({ x: 3, y: 2 });
    expect(next.toPlay).toBe('B');
    expect(reasonOf(play(next, 'd3'))).toBe('ko');
  });

  it('AC 22: a pass counts as the one turn: after W pass and B a5, W c3 is legal', () => {
    const { state } = afterBlackTakesKo();
    const passed = pass(state);
    if (!passed.ok) throw new Error('pass should be ok');
    expect(passed.state.koPoint).toBeNull();
    expect(passed.state.toPlay).toBe('B');
    const afterA5 = playOk(passed.state, 'a5').state;
    const { facts } = playOk(afterA5, 'c3');
    expect(facts.captured.map(names)).toEqual([['d3']]);
  });
});

describe('snapback (倒扑 dàopū)', () => {
  const SNAPBACK = `
    5 . . . . .
    4 . . . . .
    3 X X X . .
    2 O O O X .
    1 O . . X .
      a b c d e
  `;

  it('AC 23: throw-in, capture, and recapture of 5 stones (legal, not ko)', () => {
    const start = gameFrom(SNAPBACK, 'B');

    const throwIn = playOk(start, 'b1');
    expect(throwIn.facts.captured).toEqual([]);
    expect(throwIn.facts.selfAtari).toBe(true);
    expect(names(throwIn.facts.playedGroup.liberties)).toEqual(['c1']);
    expect(groupNames(throwIn.facts.opponentAtari)).toEqual([
      { stones: ['a1', 'a2', 'b2', 'c2'], liberties: ['c1'] },
    ]);
    expect(throwIn.facts.koPoint).toBeNull();

    const take = playOk(throwIn.state, 'c1');
    expect(take.facts.captured.map(names)).toEqual([['b1']]);
    expect(take.state.koPoint).toBeNull();
    expect(take.facts.koPoint).toBeNull();
    expect(names(take.facts.playedGroup.stones)).toEqual(['a1', 'a2', 'b2', 'c1', 'c2']);
    expect(names(take.facts.playedGroup.liberties)).toEqual(['b1']);
    expect(take.facts.selfAtari).toBe(true);
    expect(take.facts.opponentAtari).toEqual([]);

    expect(checkMove(take.state, 'b1')).toEqual({ legal: true });
    const snap = playOk(take.state, 'b1');
    expect(snap.facts.captured.map(names)).toEqual([['a1', 'a2', 'b2', 'c1', 'c2']]);
    expect(snap.state.captures).toEqual({ B: 5, W: 1 });
    expect(names(snap.facts.playedGroup.liberties)).toEqual(['a1', 'b2', 'c1']);
    expect(snap.state.koPoint).toBeNull();
    expect(show(snap.state)).toBe(
      diagram(`
        5 . . . . .
        4 . . . . .
        3 X X X . .
        2 . . . X .
        1 . X . X .
        a b c d e
      `),
    );
  });
});

// MoveFacts details (spec §3) -------------------------------------------------------------------

describe('MoveFacts', () => {
  it('reports the opponent group put in atari, and no self-atari', () => {
    // 3 . O X * .   W plays d3: B c3 keeps only c4
    // 2 . . O . .
    const state = createGame(5, { setup: { B: ['c3'], W: ['b3', 'c2'] }, toPlay: 'W' });
    const { facts } = playOk(state, 'd3');
    expect(facts.color).toBe('W');
    expect(facts.captured).toEqual([]);
    expect(groupNames(facts.opponentAtari)).toEqual([{ stones: ['c3'], liberties: ['c4'] }]);
    expect(facts.playedGroup.color).toBe('W');
    expect(names(facts.playedGroup.stones)).toEqual(['d3']);
    expect(names(facts.playedGroup.liberties)).toEqual(['d2', 'd4', 'e3']);
    expect(facts.selfAtari).toBe(false);
    expect(facts.koPoint).toBeNull();
  });

  it('lists two opponent groups put in atari by one move, sorted by first stone', () => {
    // B b2 joins b1; afterwards W a2 keeps only a1 and W c2 keeps only c1.
    const state = gameFrom(
      `
      5 . . . . .
      4 . . . . .
      3 X . X . .
      2 O . O X .
      1 . X . . .
        a b c d e
      `,
      'B',
    );
    const { facts } = playOk(state, 'b2');
    expect(groupNames(facts.opponentAtari)).toEqual([
      { stones: ['a2'], liberties: ['a1'] },
      { stones: ['c2'], liberties: ['c1'] },
    ]);
    expect(names(facts.playedGroup.stones)).toEqual(['b1', 'b2']);
    expect(names(facts.playedGroup.liberties)).toEqual(['a1', 'b3', 'c1']);
    expect(facts.selfAtari).toBe(false);
  });

  it('a play move resets consecutivePasses and keeps komi', () => {
    const passed = pass(createGame(5));
    if (!passed.ok) throw new Error('pass should be ok');
    expect(passed.state.consecutivePasses).toBe(1);
    const next = playOk(passed.state, 'c3').state;
    expect(next.consecutivePasses).toBe(0);
    expect(next.komi).toBe(0.5);
    expect(next.toPlay).toBe('B');
  });
});

describe('pass', () => {
  it('switches the turn, clears the ko point, counts the pass and records it', () => {
    const state = createGame(5);
    const result = pass(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.toPlay).toBe('W');
    expect(result.state.koPoint).toBeNull();
    expect(result.state.consecutivePasses).toBe(1);
    expect(result.state.isOver).toBe(false);
    expect(result.state.moves).toEqual([{ type: 'pass', color: 'B' }]);
    expect(result.state.board).toEqual(state.board);
    expect(state.moves).toEqual([]);
  });
});

describe('legalMoves', () => {
  it('lists every empty point on an empty board, sorted by column then row', () => {
    const moves = legalMoves(createGame(5));
    expect(moves).toHaveLength(25);
    expect(moves.slice(0, 6).map((p) => toVertex(p, 5))).toEqual([
      'a1',
      'a2',
      'a3',
      'a4',
      'a5',
      'b1',
    ]);
  });

  it('AC 18: excludes suicide points and occupied points', () => {
    const state = createGame(5, { setup: { W: ['a2', 'b1'] }, toPlay: 'B' });
    const moves = legalMoves(state).map((p) => toVertex(p, 5));
    expect(moves).not.toContain('a1');
    expect(moves).not.toContain('a2');
    expect(moves).not.toContain('b1');
    expect(moves).toHaveLength(22);
  });

  it('agrees with checkMove on every point', () => {
    const state = gameFrom(
      `
      5 . . . . .
      4 . . X O .
      3 . X O . O
      2 . . X O .
      1 . . . . .
        a b c d e
      `,
      'B',
    );
    for (const color of ['B', 'W'] as const) {
      const s = { ...state, toPlay: color };
      const expected: string[] = [];
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          if (checkMove(s, { x, y }).legal) expected.push(toVertex({ x, y }, 5));
        }
      }
      expect(legalMoves(s).map((p) => toVertex(p, 5))).toEqual(expected);
    }
  });
});

describe('game-over guard', () => {
  it('a state marked over refuses play, checkMove, legalMoves and pass', () => {
    const over: GameState = { ...createGame(5), isOver: true };
    expect(reasonOf(play(over, 'c3'))).toBe('game-over');
    expect(checkMove(over, 'c3')).toEqual({ legal: false, reason: 'game-over' });
    expect(legalMoves(over)).toEqual([]);
    expect(pass(over)).toEqual({ ok: false, reason: 'game-over' });
  });
});
