// Spec docs/specs/M6-bot-levels.md §4.1–4.2 (AC 1–6, 9–12): the 9×9 bot levels.
import { checkMove, createGame, legalMoves, pass, play, type GameState, type Move } from '@/engine';

import {
  MAX_PLIES_9,
  MC_PLAYOUTS,
  MC_TEMPERATURE,
  botRng,
  chooseMove,
  createRng,
  level3Search,
  playOnStreak,
  softmaxPick,
  type BotLevel,
  type CandidateValue,
} from './index';
import { position, vertexOf } from './__fixtures__/board';

const LEVELS: BotLevel[] = [1, 2, 3];
const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

function choose(state: GameState, level: BotLevel, seed: number, blunder = 0) {
  const choice = chooseMove(state, { level, rng: createRng(seed), board9: true, blunder });
  return { ...choice, at: vertexOf(choice.move, 9) };
}

function apply(state: GameState, move: Move): GameState {
  const result = move.type === 'pass' ? pass(state) : play(state, move.point);
  if (!result.ok) throw new Error(`illegal: ${result.reason}`);
  return result.state;
}

/** A bot-vs-bot game (both sides board9), returning every state. */
function selfPlay(black: BotLevel, white: BotLevel, seed: number, maxPlies = 400): GameState[] {
  let state = createGame(9, { komi: 5.5 });
  const states = [state];
  while (!state.isOver && state.moves.length < maxPlies) {
    const level = state.toPlay === 'B' ? black : white;
    const { move } = chooseMove(state, {
      level,
      rng: botRng(seed + (state.toPlay === 'W' ? 7919 : 0), state.moves.length),
      board9: true,
      blunder: level === 1 ? 0.5 : 0,
    });
    state = apply(state, move);
    states.push(state);
  }
  return states;
}

/** 40 plies of level 2 against itself (the midgame fixture of AC 6). */
const MIDGAME = selfPlay(2, 2, 3)[40];

/** AC 3: White captures the black stone e5 safely at e4. */
const SAFE_CAPTURE = position(
  `
  9 . . . . . . . . .
  8 . . . . . . . . .
  7 . . . . . . . . .
  6 . . . . O . . . .
  5 . . . O X O . . .
  4 . . . . . . . . .
  3 . . X . . . X . .
  2 . . . . . . . . .
  1 . . . . . . . . .
  `,
  'W',
);

/** AC 4 (§10 fixture): White d5 d6 in atari; d7 saves with 3 liberties. */
const ATARI_SAVE = position(
  `
  9 . . . . . . . . .
  8 . . . . . . . . .
  7 . . . . . . . . .
  6 . . X O X . . . .
  5 . . X O X . . . .
  4 . . . X . . . . .
  3 . . . . . . . . .
  2 . . . . . . . . .
  1 . . . . . . . . .
  `,
  'W',
);

/** AC 5: White's corner group has two eyes (a1, c1); many other points are free. */
const TWO_EYES = position(
  `
  9 . . . . . . . . .
  8 . . . . . . . . .
  7 . . . . . . . . .
  6 . . . . . . . . .
  5 . . . . X . . . .
  4 . . . . . . . . .
  3 X X X X X . . . .
  2 O O O O X . . . .
  1 . O . O X . . . .
  `,
  'W',
);

/** AC 5, 12: White's only legal points are its own two eyes. */
const ONLY_EYES = position(
  `
  9 O O O O O O O O O
  8 O O O O O O O O O
  7 O O O O O O O O O
  6 O O O O O O O O O
  5 O O O O O O O O O
  4 O O O O O O O O O
  3 O O O O O O O O O
  2 O O O O O O O O O
  1 . O . O O O O O O
  `,
  'W',
);

/** AC 10–11: a settled board, Black (the learner) just passed. `ahead` = White is ahead. */
function settled(whiteAhead: boolean): GameState {
  const rows = Array.from({ length: 9 }, (_, i) => {
    const row = whiteAhead ? '. . X O . . . . .' : '. . . . . X O . .';
    return `${9 - i} ${row}`;
  }).join('\n');
  return apply(position(rows, 'B'), { type: 'pass', color: 'B' });
}

describe('AC 1: every level returns a legal move or a pass', () => {
  const states = [
    ...selfPlay(1, 2, 11).filter((_, i) => i % 6 === 0),
    ...selfPlay(2, 1, 12).filter((_, i) => i % 6 === 0),
  ].filter((s) => !s.isOver);

  it.each(LEVELS)('level %i', (level) => {
    const sample = level === 3 ? states.filter((_, i) => i % 4 === 0) : states;
    expect(sample.length).toBeGreaterThan(5);
    for (const state of sample) {
      const { move } = chooseMove(state, { level, rng: createRng(5), board9: true, blunder: 0.5 });
      expect(move.color).toBe(state.toPlay);
      if (move.type === 'play') expect(checkMove(state, move.point)).toEqual({ legal: true });
    }
  });
});

describe('AC 2: determinism', () => {
  it.each(LEVELS)('level %i gives the same move for the same seed', (level) => {
    for (const seed of seeds(3)) {
      expect(choose(MIDGAME, level, seed)).toEqual(choose(MIDGAME, level, seed));
    }
  });
});

describe('AC 3: a safe capture', () => {
  it('levels 1 (blunder 0), 2 and 3 capture at e4 for 20 seeds', () => {
    for (const seed of seeds(20)) {
      expect(choose(SAFE_CAPTURE, 2, seed).at).toBe('e4');
      expect(choose(SAFE_CAPTURE, 3, seed).at).toBe('e4');
      expect(choose(SAFE_CAPTURE, 1, seed).at).toBe('e4');
    }
  });

  it('level 1 misses it only when its blunder roll fires', () => {
    const results = seeds(40).map((seed) => choose(SAFE_CAPTURE, 1, seed, 0.5));
    expect(results.some((r) => r.at === 'e4')).toBe(true);
    expect(results.some((r) => r.at !== 'e4')).toBe(true);
  });
});

describe('AC 4: save a group in atari', () => {
  it('levels 2 and 3 extend to d7 (3 liberties) for 20 seeds', () => {
    for (const seed of seeds(20)) {
      expect(choose(ATARI_SAVE, 2, seed).at).toBe('d7');
      expect(choose(ATARI_SAVE, 3, seed).at).toBe('d7');
    }
  });
});

describe('AC 5, 12: own eyes', () => {
  it.each(LEVELS)('level %i never fills its own eye a1 or c1', (level) => {
    for (const seed of seeds(level === 3 ? 4 : 30)) {
      expect(['a1', 'c1']).not.toContain(choose(TWO_EYES, level, seed, 0.5).at);
    }
  });

  it.each(LEVELS)('level %i passes when only its own eyes are left', (level) => {
    expect(legalMoves(ONLY_EYES)).toHaveLength(2);
    for (const seed of seeds(5)) {
      expect(choose(ONLY_EYES, level, seed, 0.5)).toMatchObject({ at: 'pass', reason: 'pass' });
    }
  });

  it('Capture Go level 1 (no board9) still plays the eye: recorded games do not change', () => {
    const choice = chooseMove(ONLY_EYES, { level: 1, rng: createRng(1) });
    expect(choice.move.type).toBe('play');
  });

  it.each(LEVELS)('level %i passes when every move is a self-atari of its group', (level) => {
    // White's only points: a1 (own eye) and e5, a self-atari that captures nothing.
    const state = position(
      `
      9 X X X X X X X X .
      8 X X X X X X X X X
      7 X X X X X X X X X
      6 X X X X X X X X X
      5 X X X X . X X X X
      4 O O O O O O O O O
      3 O O O O O O O O O
      2 O O O O O O O O O
      1 . O O O O O O O O
      `,
      'W',
    );
    expect(legalMoves(state).length).toBe(2);
    for (const seed of seeds(3)) expect(choose(state, level, seed).at).toBe('pass');
  });
});

describe('AC 6: level 3 budget', () => {
  it('runs exactly MC_PLAYOUTS = 1200 playouts on the empty board and in the midgame', () => {
    expect(MC_PLAYOUTS).toBe(1200);
    for (const state of [createGame(9, { komi: 5.5 }), MIDGAME]) {
      const search = level3Search(state, 42);
      expect(search.candidates).toHaveLength(12);
      expect(search.playouts).toBe(MC_PLAYOUTS);
      expect(search.candidates.every((c) => c.playouts === 100)).toBe(true);
      expect(level3Search(state, 42)).toEqual(search);
    }
  });
});

describe('level 3 pick: seeded softmax over the values (§12b, PO 2026-10-21)', () => {
  const candidate = (value: number): CandidateValue => ({
    point: { x: 0, y: 0 },
    prior: 0,
    wins: 0,
    playouts: 100,
    meanMargin: 0,
    value,
  });
  const counts = (values: number[], draws = 2000) => {
    const rng = createRng(7);
    const n = values.map(() => 0);
    for (let i = 0; i < draws; i++) n[softmaxPick(values.map(candidate), rng)]++;
    return n;
  };

  it('has a positive temperature and returns -1 without candidates', () => {
    expect(MC_TEMPERATURE).toBeGreaterThan(0);
    expect(softmaxPick([], createRng(1))).toBe(-1);
  });

  it('almost always plays a clearly better move (it still reads ahead)', () => {
    const [best, worse] = counts([0.9, 0.2]);
    expect(best / (best + worse)).toBeGreaterThan(0.95);
  });

  it('mixes near-equal moves, the better one more often', () => {
    const [better, close] = counts([0.55, 0.5]);
    expect(close).toBeGreaterThan(400);
    expect(better).toBeGreaterThan(close);
  });

  it('is deterministic for a seed', () => {
    const values = [0.4, 0.5, 0.45].map(candidate);
    expect(softmaxPick(values, createRng(3))).toBe(softmaxPick(values, createRng(3)));
  });
});

describe('AC 9: whole games end', () => {
  it.each([
    [1, 2],
    [2, 1],
    [2, 2],
    [1, 1],
  ] as [BotLevel, BotLevel][])('L%i vs L%i ends by two passes within 200 plies', (b, w) => {
    for (const seed of seeds(2)) {
      const states = selfPlay(b, w, seed);
      const last = states[states.length - 1];
      expect(last.isOver).toBe(true);
      expect(last.moves.length).toBeLessThanOrEqual(MAX_PLIES_9 + 2);
    }
  });

  it('at ply 200 every level passes', () => {
    const late = { ...MIDGAME, moves: Array.from({ length: 200 }, () => MIDGAME.moves[0]) };
    for (const level of LEVELS) expect(choose(late, level, 1).at).toBe('pass');
  });
});

describe('AC 10: levels 2–3 after the learner passed', () => {
  it.each([2, 3] as BotLevel[])('level %i passes when ahead', (level) => {
    expect(choose(settled(true), level, 1).at).toBe('pass');
  });

  it.each([2, 3] as BotLevel[])('level %i plays on when behind', (level) => {
    expect(choose(settled(false), level, 1).move.type).toBe('play');
  });

  it('after three play-on answers in a row it passes', () => {
    const behind = settled(false);
    const B = (type: 'pass' | 'play'): Move =>
      type === 'pass' ? { type, color: 'B' } : { type, color: 'B', point: { x: 0, y: 0 } };
    const W: Move = { type: 'play', color: 'W', point: { x: 8, y: 8 } };
    const history = [B('play'), B('pass'), W, B('pass'), W, B('pass'), W, B('pass')];
    const state = { ...behind, moves: history };
    expect(playOnStreak(state)).toBe(3);
    expect(playOnStreak({ ...behind, moves: history.slice(2) })).toBe(2);
    for (const level of [2, 3] as BotLevel[]) expect(choose(state, level, 1).at).toBe('pass');
  });
});

describe('AC 11: level 1 after the learner passed', () => {
  it('passes when no capture, save or atari applies (ahead or behind)', () => {
    for (const seed of seeds(10)) {
      expect(choose(settled(true), 1, seed, 0.5).at).toBe('pass');
      expect(choose(settled(false), 1, seed, 0.5).at).toBe('pass');
    }
  });

  it('still captures after a pass', () => {
    const state = apply({ ...SAFE_CAPTURE, toPlay: 'B' }, { type: 'pass', color: 'B' });
    expect(choose(state, 1, 1).at).toBe('e4');
  });
});

describe('level 1 opening on 9×9 (§6.1)', () => {
  it('avoids the first line while more than 40 points are empty', () => {
    for (const seed of seeds(30)) {
      const at = choose(createGame(9), 1, seed).at;
      expect(at[0]).not.toMatch(/[aj]/);
      expect(at.slice(1)).not.toMatch(/^[19]$/);
    }
  });
});
