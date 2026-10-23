// The mutable playout board must follow the engine's rules exactly (spec M6 §13: "still tested
// against the engine"): legality, captures, ko, eyes and the area score, on random 9×9 games.
import { createGame, legalMoves, pass, play, score, type GameState, type Point } from '@/engine';

import { isOwnEye } from './eyes';
import { PlayoutBoard, colorOf, winRate } from './playout';
import { createRng } from './rng';
import { position } from './__fixtures__/board';

const cellOf = (p: Point, size: number) => p.y * size + p.x;

/** Random engine games (captures likely: moves are uniform), with their states. */
function randomStates(games: number, plies: number, seed: number): GameState[] {
  const rng = createRng(seed);
  const states: GameState[] = [];
  for (let g = 0; g < games; g++) {
    let state = createGame(9, { komi: 5.5 });
    for (let i = 0; i < plies && !state.isOver; i++) {
      states.push(state);
      const moves = legalMoves(state);
      const result =
        moves.length === 0 || rng() < 0.02
          ? pass(state)
          : play(state, moves[Math.floor(rng() * moves.length)]);
      if (!result.ok) throw new Error('illegal');
      state = result.state;
    }
  }
  return states;
}

describe('PlayoutBoard matches the engine', () => {
  const states = randomStates(12, 140, 7);

  it('has the same legal points, eyes and ko on every position', () => {
    let checked = 0;
    for (const state of states) {
      const fast = PlayoutBoard.fromState(state);
      const legal = new Set(legalMoves(state).map((p) => cellOf(p, 9)));
      for (let cell = 0; cell < 81; cell++) {
        const p = { x: cell % 9, y: Math.floor(cell / 9) };
        expect({ cell, legal: fast.isLegal(cell) }).toEqual({ cell, legal: legal.has(cell) });
        expect(fast.isOwnEye(cell, 1)).toBe(isOwnEye(state.board, p, 'B'));
        expect(fast.isOwnEye(cell, 2)).toBe(isOwnEye(state.board, p, 'W'));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50000);
  });

  it('plays every legal move like the engine (board, captures, ko, turn)', () => {
    let checked = 0;
    for (const state of states.filter((_, i) => i % 5 === 0)) {
      const base = PlayoutBoard.fromState(state);
      const fast = new PlayoutBoard(9);
      for (const p of legalMoves(state)) {
        fast.copyFrom(base);
        const captured = fast.play(cellOf(p, 9));
        const result = play(state, p);
        if (!result.ok) throw new Error('illegal');
        const expected = PlayoutBoard.fromState(result.state);
        expect([...fast.cells]).toEqual([...expected.cells]);
        expect(fast.ko).toBe(expected.ko);
        expect(fast.toPlay).toBe(expected.toPlay);
        expect(captured).toBe(result.facts.captured.flat().length);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(5000);
  });

  it('lists exactly the capturing points', () => {
    const out = new Int16Array(81);
    for (const state of states) {
      const fast = PlayoutBoard.fromState(state);
      const found = [...out.slice(0, fast.captureMoves(out))].sort((a, b) => a - b);
      const expected = legalMoves(state)
        .filter((p) => {
          const result = play(state, p);
          return result.ok && result.facts.captured.length > 0;
        })
        .map((p) => cellOf(p, 9))
        .sort((a, b) => a - b);
      expect(found).toEqual(expected);
    }
  });

  it('scores like score(board, {komi}) without dead stones', () => {
    for (const state of states) {
      const fast = PlayoutBoard.fromState(state);
      const engine = score(state.board, { komi: 5.5 });
      expect(fast.areaDifference(5.5)).toBe(engine.black.total - engine.white.total);
    }
  });

  it('a pass lifts the ko ban and counts', () => {
    const state = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . . . . . .
      5 . . . . . . . . .
      4 . . . . . . . . .
      3 . X O . . . . . .
      2 X O . O . . . . .
      1 . X O . . . . . .
      `,
      'B',
    );
    const fast = PlayoutBoard.fromState(state);
    fast.play(cellOf({ x: 2, y: 1 }, 9)); // c2 captures b2: ko at b2
    expect(fast.ko).toBe(cellOf({ x: 1, y: 1 }, 9));
    expect(fast.isLegal(fast.ko)).toBe(false);
    fast.pass();
    expect(fast.ko).toBe(-1);
    expect(fast.passes).toBe(1);
    expect(colorOf(fast.toPlay)).toBe('B');
  });
});

describe('random playouts (§6.3 policy)', () => {
  it('never fill an own eye, end on two passes or the ply cap, and are seed-reproducible', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const run = () => {
        const board = PlayoutBoard.fromState(createGame(9, { komi: 5.5 }));
        const rng = createRng(seed);
        while (board.plies < 110 && board.passes < 2) {
          const cell = board.randomMove(rng);
          if (cell < 0) {
            board.pass();
            continue;
          }
          expect(board.isOwnEye(cell, board.toPlay)).toBe(false);
          expect(board.isLegal(cell)).toBe(true);
          board.play(cell);
        }
        return { cells: [...board.cells], plies: board.plies, passes: board.passes };
      };
      const a = run();
      expect(run()).toEqual(a);
      expect(a.plies === 110 || a.passes === 2).toBe(true);
    }
  });

  it('takes an available capture with p ≈ 0.5 or more', () => {
    const state = position(
      `
      9 . . . . . . . . .
      8 . . . . . . . . .
      7 . . . . . . . . .
      6 . . . . X . . . .
      5 . . . X O X . . .
      4 . . . . . . . . .
      3 . . . . . . . . .
      2 . . . . . . . . .
      1 . . . . . . . . .
      `,
      'B',
    );
    const base = PlayoutBoard.fromState(state);
    const e4 = cellOf({ x: 4, y: 3 }, 9);
    let taken = 0;
    for (let seed = 1; seed <= 400; seed++) {
      if (base.randomMove(createRng(seed)) === e4) taken++;
    }
    expect(taken / 400).toBeGreaterThan(0.45);
    expect(taken / 400).toBeLessThan(0.6);
  });
});

describe('winRate (M6-game-coaching AC 27–28)', () => {
  it('is seeded, in [0, 1], and 1 for a side that owns the whole board', () => {
    const empty = createGame(9, { komi: 5.5 });
    const a = winRate(empty, 'B', 40, 80, 7);
    expect(a).toBe(winRate(empty, 'B', 40, 80, 7));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
    const black = position(
      `
      X X X X X
      X . X . X
      X X X X X
      X . X . X
      X X X X X
    `,
      'W',
    );
    expect(winRate(black, 'B', 10, 80, 1)).toBe(1);
    expect(winRate(black, 'W', 10, 80, 1)).toBe(0);
  });
});
