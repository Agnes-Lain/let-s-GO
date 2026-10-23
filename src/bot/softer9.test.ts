// Spec docs/specs/M6-beginner-friendly.md §4.4 (AC 37–39, 42): softer Easy and Normal on 9×9.
import { createGame, toVertex, type GameState } from '@/engine';

import { chooseMove, createRng, scoreMoves, type BotOptions } from './index';
import { position } from './__fixtures__/board';

const seeds = Array.from({ length: 40 }, (_, i) => i + 1);

// White e5 in atari (liberty e4); White to move, nothing to capture.
const SAVE9 = position(
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
  'W',
);

// Black e5 between White d5 and f5 (liberties e6, e4): White can play atari.
const ATARI9 = position(
  `
  9 . . . . . . . . .
  8 . . . . . . . . .
  7 . . . . . . . . .
  6 . . . . . . . . .
  5 . . . O X O . . .
  4 . . . . . . . . .
  3 . . . . . . . . .
  2 . . . . . . . . .
  1 . . . . . . . . .
  `,
  'W',
);

// White can capture Black e5 at e4.
const CAPTURE9 = position(
  `
  9 . . . . . . . . .
  8 . . . . . . . . .
  7 . . . . . . . . .
  6 . . . . O . . . .
  5 . . . O X O . . .
  4 . . . . . . . . .
  3 . . . . . . . . .
  2 . . . . . . . . .
  1 . . . . . . . . .
  `,
  'W',
);

function reasons(state: GameState, opts: Omit<BotOptions, 'rng'>): string[] {
  return seeds.map((seed) => chooseMove(state, { ...opts, rng: createRng(seed) }).reason);
}

describe('level 1 on 9×9: skipSave / skipAtari (§4.4)', () => {
  const base = { level: 1 as const, board9: true, blunder: 0 };

  it('without the new options it always saves and always ataris (unchanged)', () => {
    expect(new Set(reasons(SAVE9, base))).toEqual(new Set(['save']));
    expect(new Set(reasons(ATARI9, base))).toEqual(new Set(['atari']));
  });

  it('skipSave 1 never saves; skipAtari 1 never ataris', () => {
    expect(reasons(SAVE9, { ...base, skipSave: 1 })).not.toContain('save');
    expect(reasons(ATARI9, { ...base, skipAtari: 1 })).not.toContain('atari');
  });

  it('skipSave 0.35 skips some saves, not all', () => {
    const r = reasons(SAVE9, { ...base, skipSave: 0.35 });
    const saves = r.filter((x) => x === 'save').length;
    expect(saves).toBeGreaterThan(0);
    expect(saves).toBeLessThan(r.length);
  });

  it('captures stay (missed only by the blunder roll)', () => {
    expect(new Set(reasons(CAPTURE9, { ...base, skipSave: 1, skipAtari: 1 }))).toEqual(
      new Set(['capture']),
    );
  });

  it('the first three rng draws are the same as without the options', () => {
    const drawn = (opts: Partial<BotOptions>) => {
      const values: number[] = [];
      const inner = createRng(11);
      chooseMove(SAVE9, {
        level: 1,
        board9: true,
        ...opts,
        rng: () => {
          const x = inner();
          values.push(x);
          return x;
        },
      });
      return values.slice(0, 3);
    };
    expect(drawn({ skipSave: 1, skipAtari: 1 })).toEqual(drawn({}));
  });

  it('Capture Go (no board9) ignores the options and still draws exactly 3 numbers', () => {
    let draws = 0;
    const inner = createRng(3);
    const opts = {
      level: 1 as const,
      skipSave: 1,
      skipAtari: 1,
      rng: () => {
        draws++;
        return inner();
      },
    };
    expect(chooseMove(SAVE9, opts).reason).toBe('save');
    expect(draws).toBe(3);
  });
});

describe('level 2: the slip (AC 39)', () => {
  it('slip 1 on the empty board plays below the best score; slip 0 plays the best', () => {
    const empty = createGame(9);
    const scored = scoreMoves(empty);
    const top = scored[0].score;
    const scoreOf = (v: string) => scored.find((m) => toVertex(m.point, 9) === v)?.score;
    for (const seed of seeds.slice(0, 10)) {
      const best = chooseMove(empty, { level: 2, rng: createRng(seed) }).move;
      const slipped = chooseMove(empty, { level: 2, slip: 1, rng: createRng(seed) }).move;
      if (best.type !== 'play' || slipped.type !== 'play') throw new Error('pass');
      expect(scoreOf(toVertex(best.point, 9))).toBe(top);
      expect(scoreOf(toVertex(slipped.point, 9))).toBeLessThan(top);
    }
  });

  it('never slips when a capture or a save exists (bot-levels AC 3–4)', () => {
    for (const seed of seeds.slice(0, 10)) {
      expect(chooseMove(CAPTURE9, { level: 2, slip: 1, rng: createRng(seed) }).reason).toBe(
        'capture',
      );
      expect(chooseMove(SAVE9, { level: 2, slip: 1, rng: createRng(seed) }).reason).toBe('save');
    }
  });
});
