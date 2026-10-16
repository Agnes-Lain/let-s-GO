import { createGame, play, type GameState, type PlayResult } from '@/engine';

import { position, sampleLesson } from './__fixtures__/fixtures';
import { getSolution, goalMet, solutionPoints } from './goals';
import type { Exercise, Goal } from './schema';

function exercise(ascii: string, goal: Goal, toPlay: 'B' | 'W' = 'B'): Exercise {
  return { id: 'x', type: 'play-move', toPlay, goal, promptKey: 'p', ...position(ascii) };
}

function game(ascii: string, toPlay: 'B' | 'W' = 'B'): GameState {
  const { size, setup } = position(ascii);
  return createGame(size, { setup, toPlay });
}

function played(state: GameState, at: string): Extract<PlayResult, { ok: true }> {
  const result = play(state, at);
  if (!result.ok) throw new Error(`${at} should be legal`);
  return result;
}

const sample = sampleLesson().exercises as Exercise[];

describe('getSolution (AC 13–17, 20)', () => {
  it('AC 13: the e3 capture has one solution, d3', () => {
    expect(getSolution(sample[2])).toEqual({ points: ['d3'] });
  });

  it('AC 14: atari on a 2-liberty stone: b3 and c4', () => {
    const board = `
      5 . . . . .
      4 . . . . .
      3 . . O X .
      2 . . X . .
      1 . . . . .
        a b c d e
    `;
    expect(getSolution(exercise(board, { kind: 'atari' }))).toEqual({ points: ['b3', 'c4'] });
  });

  it('AC 15: the e4 connect exercise: c3', () => {
    expect(getSolution(sample[3])).toEqual({ points: ['c3'] });
  });

  it('AC 16: save B c3 in atari: c2', () => {
    const board = `
      5 . . . . .
      4 . . O . .
      3 . O X O .
      2 . . . . .
      1 . . . . .
        a b c d e
    `;
    expect(getSolution(exercise(board, { kind: 'save', target: 'c3' }))).toEqual({
      points: ['c2'],
    });
  });

  it('AC 17: goal point d3', () => {
    const board = `
      5 . . . . .
      4 . . . . .
      3 . . X . O
      2 . . . . .
      1 . . . . .
        a b c d e
    `;
    expect(getSolution(exercise(board, { kind: 'point', points: ['d3'] }))).toEqual({
      points: ['d3'],
    });
  });

  it('tap-point: listed points, or the liberties of a group', () => {
    expect(getSolution(sample[0])).toEqual({ points: ['c4'] });
    expect(getSolution(sample[1])).toEqual({ points: ['b1', 'c2', 'd1'] });
  });

  it('choice: the index of the correct option', () => {
    expect(getSolution(sample[4])).toEqual({ index: 2 });
  });

  it('AC 20: count libertiesOf d4 on the 7×7 sample is 5', () => {
    expect(getSolution(sample[5])).toEqual({ value: 5 });
    expect(solutionPoints(sample[5])).toEqual(['c4', 'd3', 'e3', 'e5', 'f4']);
    expect(getSolution({ ...sample[5], answer: 3 } as Exercise)).toEqual({ value: 3 });
    expect(solutionPoints({ ...sample[5], answer: 3 } as Exercise)).toEqual([]);
  });
});

describe('goalMet (AC 30)', () => {
  //   5 . . . . .
  //   4 . . . . X
  //   3 . . . . O     W e3 has one liberty (d3)
  //   2 . . . . X
  //   1 . . . . .
  const e3 = game(`
    . . . . .
    . . . . X
    . . . . O
    . . . . X
    . . . . .
  `);

  it('capture: min 1 with 1 captured → true; min 2 → false', () => {
    const result = played(e3, 'd3');
    expect(goalMet({ kind: 'capture' }, e3, result)).toBe(true);
    expect(goalMet({ kind: 'capture', min: 2 }, e3, result)).toBe(false);
    expect(goalMet({ kind: 'capture' }, e3, played(e3, 'c3'))).toBe(false);
  });

  it('atari: one opponent group left with one liberty → true', () => {
    const before = game(`
      . . . . .
      . . . . .
      . . O X .
      . . X . .
      . . . . .
    `);
    const result = played(before, 'b3');
    expect(result.facts.opponentAtari).toHaveLength(1);
    expect(goalMet({ kind: 'atari' }, before, result)).toBe(true);
    expect(goalMet({ kind: 'atari' }, before, played(before, 'a1'))).toBe(false);
  });

  it('connect: a and b joined → true; not joined → false', () => {
    const before = game(`
      . . . . .
      . . O . .
      . X . X .
      . . O . .
      . . . . .
    `);
    const goal: Goal = { kind: 'connect', a: 'b3', b: 'd3' };
    expect(goalMet(goal, before, played(before, 'c3'))).toBe(true);
    expect(goalMet(goal, before, played(before, 'b4'))).toBe(false);
  });

  it('save: 2 liberties after the move → true; 1 → false', () => {
    const before = game(`
      . . . . .
      . . O . .
      . O X O .
      . . . . .
      . . . . .
    `);
    const goal: Goal = { kind: 'save', target: 'c3' };
    expect(goalMet(goal, before, played(before, 'c2'))).toBe(true);
    //  After B a1 the stone on c3 still has only c2.
    expect(goalMet(goal, before, played(before, 'a1'))).toBe(false);
  });

  it('point: in the list → true; not in the list → false', () => {
    const empty = createGame(5);
    expect(goalMet({ kind: 'point', points: ['c3'] }, empty, played(empty, 'c3'))).toBe(true);
    expect(goalMet({ kind: 'point', points: ['c3'] }, empty, played(empty, 'd3'))).toBe(false);
  });
});
