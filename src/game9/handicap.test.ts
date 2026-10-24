// Spec docs/specs/M6-beginner-friendly.md §3, AC 1, 9, 10, 11, 14.
import { createGame, groupAt, parseVertex, printBoard } from '@/engine';

import {
  HANDICAP_CHOICES,
  HANDICAP_KOMI,
  STARTING_HANDICAP,
  handicapStones,
  isHandicap,
  nextHandicap,
  stepDown,
  stepUp,
  suggestedHandicap,
} from './handicap';

describe('handicapStones (AC 1, §3)', () => {
  it('returns the §3 star points, each list a prefix of the next', () => {
    expect(handicapStones(9, 0)).toEqual([]);
    expect(handicapStones(9, 2)).toEqual(['c3', 'g7']);
    expect(handicapStones(9, 3)).toEqual(['c3', 'g7', 'g3']);
    expect(handicapStones(9, 4)).toEqual(['c3', 'g7', 'g3', 'c7']);
    expect(handicapStones(9, 5)).toEqual(['c3', 'g7', 'g3', 'c7', 'e5']);
  });

  it.each([1, 6, -1, 2.5, NaN])('throws for n = %p', (n) => {
    expect(() => handicapStones(9, n)).toThrow();
  });

  it('n = 5 matches the §3 diagram; every stone is alone with 4 liberties', () => {
    const game = createGame(9, { setup: { B: handicapStones(9, 5) }, toPlay: 'W' });
    expect(printBoard(game.board)).toBe(
      [
        '. . . . . . . . .',
        '. . . . . . . . .',
        '. . X . . . X . .',
        '. . . . . . . . .',
        '. . . . X . . . .',
        '. . . . . . . . .',
        '. . X . . . X . .',
        '. . . . . . . . .',
        '. . . . . . . . .',
      ].join('\n'),
    );
    for (const v of handicapStones(9, 5)) {
      const group = groupAt(game.board, parseVertex(v, 9));
      expect(group?.stones).toHaveLength(1);
      expect(group?.liberties).toHaveLength(4);
    }
  });

  it('komi 0.5 in handicap games', () => expect(HANDICAP_KOMI).toBe(0.5));
});

describe('the handicap ladder 0 ↔ 2 ↔ 3 ↔ 4 ↔ 5 (AC 11)', () => {
  it('steps down and up', () => {
    expect(HANDICAP_CHOICES.map(stepDown)).toEqual([0, 0, 2, 3, 4]);
    expect(HANDICAP_CHOICES.map(stepUp)).toEqual([2, 3, 4, 5, 5]);
  });

  it('nextHandicap: win → down; loss or resignation → up', () => {
    expect(nextHandicap(3, 'win')).toBe(2);
    expect(nextHandicap(3, 'loss')).toBe(4);
    expect(nextHandicap(5, 'resigned')).toBe(5);
    expect(nextHandicap(0, 'win')).toBe(0);
  });

  it('only 0, 2, 3, 4, 5 are handicaps', () => {
    expect(HANDICAP_CHOICES).toEqual([0, 2, 3, 4, 5]);
    expect([0, 2, 3, 4, 5].every(isHandicap)).toBe(true);
    expect([1, 6, -2, 2.5, '3', null, undefined].some(isHandicap)).toBe(false);
  });
});

describe('the suggestion (AC 9, 10)', () => {
  it('falls back to the starting table when nothing (or garbage) is stored', () => {
    for (const level of [1, 2, 3] as const) {
      expect(suggestedHandicap({}, level)).toBe(STARTING_HANDICAP[level]);
      const key = String(level) as '1' | '2' | '3';
      expect(
        suggestedHandicap({ [key]: { games: 1, wins: 0, lossStreak: 1, handicap: 7 } }, level),
      ).toBe(STARTING_HANDICAP[level]);
    }
  });

  it('uses the stored value', () => {
    expect(suggestedHandicap({ '2': { games: 3, wins: 3, lossStreak: 0, handicap: 0 } }, 2)).toBe(
      0,
    );
  });

  it('the starting table is a valid handicap per level', () => {
    expect([1, 2, 3].map((l) => isHandicap(STARTING_HANDICAP[l as 1 | 2 | 3]))).toEqual([
      true,
      true,
      true,
    ]);
  });
});
