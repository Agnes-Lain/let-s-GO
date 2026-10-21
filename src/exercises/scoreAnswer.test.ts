// Wrong-count lines (spec docs/specs/M5-territory-counting.md AC 42–43). X black, O white.
import { parseBoard } from '@/engine';
import type { ScoreAnswer } from '@/lessons';

import { classifyScoreAnswer, scoreRevealLine } from './scoreAnswer';

const D = parseBoard(`
  5 . . . . .
  4 O O O O O
  3 X X X . .
  2 . . X X X
  1 . . . . .
    a b c d e
`).board;

const K = parseBoard(`
  5 . . . . .
  4 . . . . .
  3 O O O O O
  2 X X X X X
  1 . . O . .
    a b c d e
`).board;

describe('classifyScoreAnswer (AC 42)', () => {
  const areaB = { of: 'area', side: 'B' } as const;

  it.each([
    [13, null],
    [6, 'fb.count.score.stonesOnly'],
    [7, 'fb.count.score.territoryOnly'],
    [15, 'fb.count.score.withDame'],
    [10, 'fb.count.score.otherSide'],
    [14, 'fb.count.score.wrong'],
  ])('D, Black area (13): typing %i → %s', (typed, key) => {
    const line = classifyScoreAnswer(D, areaB, typed);
    expect(line?.key ?? null).toBe(key);
  });

  it('K, Black area with dead c1 (10): typing 5 → deadKept (5 stones + 0 territory with c1)', () => {
    const answer: ScoreAnswer = { of: 'area', side: 'B', dead: ['c1'] };
    expect(classifyScoreAnswer(K, answer, 10)).toBeNull();
    expect(classifyScoreAnswer(K, answer, 5)?.key).toBe('fb.count.score.deadKept');
    expect(classifyScoreAnswer(K, answer, 15)?.key).toBe('fb.count.score.otherSide');
  });

  it('a rule whose value equals the right answer is skipped (stones asked: 6 is right)', () => {
    const stones = { of: 'stones', side: 'B' } as const;
    expect(classifyScoreAnswer(D, stones, 6)).toBeNull();
    expect(classifyScoreAnswer(D, stones, 7)?.key).toBe('fb.count.score.territoryOnly');
    expect(classifyScoreAnswer(D, stones, 5)?.key).toBe('fb.count.score.otherSide');
  });
});

describe('scoreRevealLine (AC 43)', () => {
  it('D, Black area: 6 stones + 7 points = 13', () => {
    expect(scoreRevealLine(D, { of: 'area', side: 'B' })).toEqual({
      key: 'fb.count.score.reveal',
      params: { stones: 6, territory: 7, total: 13 },
    });
  });

  it('K, White area with dead c1 removed: 5 + 10 = 15', () => {
    expect(scoreRevealLine(K, { of: 'area', side: 'W', dead: ['c1'] }).params).toEqual({
      stones: 5,
      territory: 10,
      total: 15,
    });
  });
});
