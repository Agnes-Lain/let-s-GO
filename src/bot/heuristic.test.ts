import * as engine from '@/engine';
import { checkMove, createGame, legalMoves, play, type GameState } from '@/engine';

import { chooseMove, createRng, type BotOptions } from './index';
import { playAt, position, vertexOf } from './__fixtures__/board';

function choose(state: GameState, blunder: number, seed: number, level: BotOptions['level'] = 1) {
  const choice = chooseMove(state, { level, blunder, rng: createRng(seed) });
  return { ...choice, at: vertexOf(choice.move, state.board.size) };
}

const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/** AC 5 */
const CAPTURE = position(
  `
  5 . . . . .
  4 . . O . .
  3 . O X O .
  2 . . . . .
  1 . . . . .
  `,
  'W',
);
/** AC 6 */
const LARGEST = position(
  `
  5 . . . O .
  4 . . O X O
  3 . . O X .
  2 O . . O .
  1 X . . . .
  `,
  'W',
);
/** AC 7 */
const SAVE = position(
  `
  5 . . . . .
  4 . . X . .
  3 . X O X .
  2 . . . . .
  1 . . . . .
  `,
  'W',
);
/** AC 8 */
const ATARI = position(
  `
  5 . . . . .
  4 . . . . .
  3 . . O . .
  2 . . . . .
  1 X . . . .
  `,
  'W',
);

/** 200 positions: a 5×5 or 7×7 board after 6 random legal moves (AC 9, 10). */
function randomPositions(): GameState[] {
  return seeds(200).map((seed) => {
    const rng = createRng(seed * 7919);
    let state = createGame(seed % 2 === 0 ? 5 : 7);
    for (let i = 0; i < 6; i++) {
      const moves = legalMoves(state);
      const p = moves[Math.floor(rng() * moves.length)];
      const result = play(state, p);
      if (!result.ok) throw new Error('random move should be legal');
      state = result.state;
    }
    return state;
  });
}

describe('chooseMove: API (AC 2, 3, 4, 15)', () => {
  it('AC 2: returns a legal move for toPlay and never mutates the state', () => {
    const state = Object.freeze({ ...CAPTURE });
    const copy = JSON.parse(JSON.stringify(state));
    for (const seed of seeds(20)) {
      const { move } = chooseMove(state, { level: 1, blunder: 0.5, rng: createRng(seed) });
      expect(move.type).toBe('play');
      if (move.type === 'play') {
        expect(move.color).toBe('W');
        expect(checkMove(state, move.point)).toEqual({ legal: true });
      }
    }
    expect(state).toEqual(copy);
  });

  it('AC 3: the same state, blunder and seed give the same result 100 times', () => {
    const first = choose(SAVE, 0.5, 9);
    for (let i = 0; i < 100; i++) expect(choose(SAVE, 0.5, 9)).toEqual(first);
  });

  it('AC 4: consumes exactly 3 values from rng per call', () => {
    for (const state of [CAPTURE, SAVE, ATARI, createGame(9)]) {
      for (const blunder of [0, 0.5, 1]) {
        let draws = 0;
        const base = createRng(5);
        const rng = () => {
          draws++;
          return base();
        };
        chooseMove(state, { level: 1, blunder, rng });
        expect(draws).toBe(3);
      }
    }
  });

  // M4 AC 15 ("levels 2 and 3 fall back to level 1") was replaced by M6 AC 1: every level is
  // registered. Level 1 itself is unchanged; levels 2–3 have their own tests (level2/3.test.ts).
  it('M6 AC 1: levels 2 and 3 are registered and are not level 1', () => {
    const differs = seeds(10).some(
      (seed) =>
        JSON.stringify(choose(SAVE, 0.3, seed, 2)) !== JSON.stringify(choose(SAVE, 0.3, seed, 1)),
    );
    expect(differs).toBe(true);
    for (const seed of seeds(3)) {
      expect(choose(SAVE, 0, seed, 3).move.type).toBe('play');
    }
  });

  it('blunder defaults to 0', () => {
    const { move, reason } = chooseMove(CAPTURE, { level: 1, rng: createRng(1) });
    expect(reason).toBe('capture');
    expect(vertexOf(move, 5)).toBe('c2');
  });
});

describe('chooseMove: rules of thumb (AC 5–8)', () => {
  it('AC 5: capture first — c2', () => {
    for (const seed of seeds(20)) {
      expect(choose(CAPTURE, 0, seed)).toMatchObject({ at: 'c2', reason: 'capture' });
    }
  });

  it('AC 6: largest capture — e3 (two stones), not b1 (one stone)', () => {
    for (const seed of seeds(20)) {
      expect(choose(LARGEST, 0, seed)).toMatchObject({ at: 'e3', reason: 'capture' });
    }
  });

  it('AC 7: save own stone — c2, the group then has 3 liberties (b2 d2 c1)', () => {
    for (const seed of seeds(20)) {
      expect(choose(SAVE, 0, seed)).toMatchObject({ at: 'c2', reason: 'save' });
    }
    const after = playAt(SAVE, 'c2');
    const libs = engine.liberties(after.board, 'c3')?.map((p) => engine.toVertex(p, 5));
    expect(libs?.sort()).toEqual(['b2', 'c1', 'd2']);
  });

  it('AC 8: atari the opponent — a2 or b1, the stone keeps ≥ 2 liberties', () => {
    const seen = new Set<string>();
    for (const seed of seeds(50)) {
      const { at, reason } = choose(ATARI, 0, seed);
      expect(reason).toBe('atari');
      expect(['a2', 'b1']).toContain(at);
      expect(engine.liberties(playAt(ATARI, at).board, at)?.length).toBeGreaterThanOrEqual(2);
      seen.add(at);
    }
    expect(seen.size).toBe(2); // ties are broken by the rng
  });
});

describe('chooseMove: safety (AC 9, 10, 14)', () => {
  const positions = randomPositions();

  it('AC 9: no self-atari for atari / pressure / random unless every legal move is one', () => {
    let checked = 0;
    positions.forEach((state, i) => {
      const { move, reason } = chooseMove(state, { level: 1, blunder: 0, rng: createRng(i + 1) });
      if (!['atari', 'pressure', 'random'].includes(reason) || move.type !== 'play') return;
      checked++;
      const result = play(state, move.point);
      if (!result.ok) throw new Error('illegal');
      if (result.facts.selfAtari) {
        const allSelfAtari = legalMoves(state).every((p) => {
          const r = play(state, p);
          return r.ok && r.facts.selfAtari;
        });
        expect(allSelfAtari).toBe(true);
      }
    });
    expect(checked).toBeGreaterThan(100);
  });

  it.each([0, 0.5, 1])('AC 10: always legal with blunder %p', (blunder) => {
    positions.forEach((state, i) => {
      const { move } = chooseMove(state, { level: 1, blunder, rng: createRng(i + 1) });
      expect(move.type).toBe('play');
      if (move.type === 'play') expect(checkMove(state, move.point)).toEqual({ legal: true });
    });
  });

  it('AC 14: never retakes the ko at once (b3)', () => {
    const start = createGame(5, {
      setup: { B: ['b4', 'a3', 'b2'], W: ['c4', 'b3', 'd3', 'c2'] },
      toPlay: 'B',
    });
    const ko = playAt(start, 'c3');
    expect(ko.koPoint).toEqual({ x: 1, y: 2 });
    for (const blunder of [0, 1]) {
      for (const seed of seeds(50)) expect(choose(ko, blunder, seed).at).not.toBe('b3');
    }
  });
});

describe('chooseMove: blunders (AC 11, 12)', () => {
  it('AC 11: with blunder 1 the save is mostly missed, but every move is legal', () => {
    let saves = 0;
    for (const seed of seeds(200)) {
      const { move, at } = choose(SAVE, 1, seed);
      if (at === 'c2') saves++;
      if (move.type === 'play') expect(checkMove(SAVE, move.point).legal).toBe(true);
    }
    expect(saves).toBeLessThan(60);
    expect(seeds(200).filter((seed) => choose(SAVE, 0, seed).at === 'c2')).toHaveLength(200);
  });

  it('AC 12: with blunder 0.5 the capture is still found in at least 70%', () => {
    const captures = seeds(200).filter((seed) => choose(CAPTURE, 0.5, seed).at === 'c2').length;
    expect(captures).toBeGreaterThanOrEqual(140);
    expect(captures).toBeLessThanOrEqual(180); // missed with probability ≈ blunder / 2
  });
});

describe('chooseMove: speed (AC 16)', () => {
  it('answers in under 50 ms on a 9×9 board with 20 stones', () => {
    const rng = createRng(11);
    let state = createGame(9);
    while (state.board.cells.filter((c) => c !== null).length < 20) {
      const moves = legalMoves(state);
      state = playAt(state, engine.toVertex(moves[Math.floor(rng() * moves.length)], 9));
    }
    chooseMove(state, { level: 1, rng: createRng(1) }); // warm-up (JIT)
    const runs = 10;
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < runs; i++) chooseMove(state, { level: 1, rng: createRng(i) });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / runs;
    expect(ms).toBeLessThan(50);
  });
});
