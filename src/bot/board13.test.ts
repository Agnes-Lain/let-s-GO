// Spec docs/specs/M6b-13x13-game.md §8, AC 26–29, 36: the bots on a 13×13 board. The 9×9
// numbers stay as they were (AC 39); 13×13 gets its own ply cap and playout budget.
import { checkMove, createGame, pass, play, type GameState, type Move } from '@/engine';

import {
  DEAD_PLAYOUT_PLIES,
  MAX_PLIES_13,
  MAX_PLIES_9,
  MC_MAX_PLIES,
  MC_MAX_PLIES_13,
  MC_PLAYOUTS,
  MC_PLAYOUTS_13,
  botRng,
  chooseMove,
  createRng,
  deadPlayoutPlies,
  level3Search,
  maxPliesFor,
  mcBudget,
  openingEmptyPoints,
  OPENING_EMPTY_POINTS,
  proposeDead,
  type BotLevel,
} from './index';
import { position, vertexOf } from './__fixtures__/board';

const LEVELS: BotLevel[] = [1, 2, 3];

function apply(state: GameState, move: Move): GameState {
  const result = move.type === 'pass' ? pass(state) : play(state, move.point);
  if (!result.ok) throw new Error(`illegal: ${result.reason}`);
  return result.state;
}

/** `plies` moves of level 2 against itself on 13×13 (a midgame fixture). */
function selfPlay13(plies: number, seed: number): GameState {
  let state = createGame(13, { komi: 6.5 });
  while (!state.isOver && state.moves.length < plies) {
    const { move } = chooseMove(state, {
      level: 2,
      rng: botRng(seed, state.moves.length),
      boardN: true,
    });
    state = apply(state, move);
  }
  return state;
}

const MIDGAME_13 = selfPlay13(30, 5);

describe('§8: size-dependent numbers', () => {
  it('AC 26: the ply cap is 200 on 9×9 and 400 on 13×13', () => {
    expect(MAX_PLIES_9).toBe(200);
    expect(MAX_PLIES_13).toBe(400);
    expect(maxPliesFor(9)).toBe(200);
    expect(maxPliesFor(13)).toBe(400);
  });

  it('AC 28: level 3 uses 1 200 / 110 on 9×9 and 600 / 220 on 13×13', () => {
    expect(mcBudget(9)).toEqual({ candidates: 12, perCandidate: 100, maxPlies: 110 });
    expect(mcBudget(13)).toEqual({ candidates: 12, perCandidate: 50, maxPlies: 220 });
    expect(MC_PLAYOUTS).toBe(1200);
    expect(MC_MAX_PLIES).toBe(110);
    expect(MC_PLAYOUTS_13).toBe(600);
    expect(MC_MAX_PLIES_13).toBe(220);
  });

  it('the 9×9 opening and dead-stone numbers are unchanged; 13×13 scales with the area', () => {
    expect(openingEmptyPoints(9)).toBe(OPENING_EMPTY_POINTS);
    expect(openingEmptyPoints(13)).toBe(Math.round((OPENING_EMPTY_POINTS * 169) / 81));
    expect(deadPlayoutPlies(9)).toBe(DEAD_PLAYOUT_PLIES);
    expect(deadPlayoutPlies(13)).toBe(2 * DEAD_PLAYOUT_PLIES);
  });
});

describe('AC 27: every level returns a legal move or a pass on 13×13', () => {
  it.each(LEVELS)('level %i, empty board and midgame', (level) => {
    for (const state of [createGame(13, { komi: 6.5 }), MIDGAME_13]) {
      for (const seed of [1, 2]) {
        const { move } = chooseMove(state, {
          level,
          rng: createRng(seed),
          boardN: true,
          blunder: level === 1 ? 0.6 : 0,
        });
        if (move.type === 'play') expect(checkMove(state, move.point).legal).toBe(true);
      }
    }
  });

  it('level 1 opens away from the first line on 13×13', () => {
    const empty = createGame(13, { komi: 6.5 });
    for (let seed = 1; seed <= 20; seed++) {
      const { move } = chooseMove(empty, { level: 1, rng: createRng(seed), boardN: true });
      expect(move.type).toBe('play');
      if (move.type !== 'play') continue;
      const { x, y } = move.point;
      expect(Math.min(x, y, 12 - x, 12 - y)).toBeGreaterThan(0);
    }
  });

  it('`board9: true` (old name) behaves exactly like `boardN: true`', () => {
    for (const level of LEVELS) {
      const a = chooseMove(MIDGAME_13, { level, rng: createRng(3), boardN: true });
      const b = chooseMove(MIDGAME_13, { level, rng: createRng(3), board9: true });
      expect(vertexOf(a.move, 13)).toBe(vertexOf(b.move, 13));
    }
  });
});

describe('AC 26: the 13×13 ply cap', () => {
  const at = (n: number) => ({
    ...MIDGAME_13,
    moves: Array.from({ length: n }, () => MIDGAME_13.moves[0]),
  });

  it('at ply 200 the bots still play on 13×13 (the 9×9 cap does not apply)', () => {
    for (const level of LEVELS) {
      const { move } = chooseMove(at(200), { level, rng: createRng(1), boardN: true });
      expect(move.type).toBe('play');
    }
  });

  it('at ply 400 every level passes', () => {
    for (const level of LEVELS) {
      const { move } = chooseMove(at(400), { level, rng: createRng(1), boardN: true });
      expect(move.type).toBe('pass');
    }
  });
});

describe('AC 28: level 3 budget on 13×13 is a count, never a clock', () => {
  it('runs 50 playouts per candidate, at most 600 in all', () => {
    const search = level3Search(MIDGAME_13, 42);
    expect(search.candidates.length).toBeGreaterThan(0);
    expect(search.candidates.length).toBeLessThanOrEqual(12);
    for (const c of search.candidates) expect(c.playouts).toBe(50);
    expect(search.playouts).toBe(50 * search.candidates.length);
    expect(search.playouts).toBeLessThanOrEqual(MC_PLAYOUTS_13);
  });

  it('the same seed gives the same move', () => {
    const a = level3Search(MIDGAME_13, 7).best?.point;
    const b = level3Search(MIDGAME_13, 7).best?.point;
    expect(a).toEqual(b);
  });

  it('AC 29: desktop smoke bound ≤ 1.5 s per level 3 move', () => {
    const start = Date.now();
    level3Search(MIDGAME_13, 9);
    expect(Date.now() - start).toBeLessThanOrEqual(1500);
  });
});

describe('AC 36: the dead-stone proposal accepts 13×13 (basic case)', () => {
  // A settled, seki-free board: both big groups have four eyes; the lone White stone a1 sits in
  // Black's small lower-left corner and cannot make two eyes.
  const CORNER = position(
    `
    13 X . X . X X O . O . O O O
    12 X X X X X X O O O O O O O
    11 X . X . X X O . O . O O O
    10 X X X X X X O O O O O O O
     9 X X X X X X O O O O O O O
     8 X X X X X X O O O O O O O
     7 X X X X X X O O O O O O O
     6 X X X X X X O O O O O O O
     5 X X X X X X O O O O O O O
     4 X X X X X X O O O O O O O
     3 X X X X X X O O O O O O O
     2 . . X X X X O O O O O O O
     1 O . X X X X O O O O O O O
       a b c d e f g h j k l m n
    `,
    'B',
  );

  it('proposes the lone White stone in Black’s corner as dead, and no other stone', () => {
    expect(proposeDead(CORNER, createRng(1))).toEqual(['a1']);
  });
});
