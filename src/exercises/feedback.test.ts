import { parseVertex } from '@/engine';
import { position } from '@/lessons/__fixtures__/fixtures';
import type { Goal, PlayMoveExercise } from '@/lessons';

import { exerciseGame, judgePlayMove } from './engineAdapter';
import { illegalFeedback, tapAllFeedback } from './feedback';
import { judgeTapAll } from './judge';

function exercise(ascii: string, goal: Goal): PlayMoveExercise {
  return { id: 'x', type: 'play-move', toPlay: 'B', goal, promptKey: 'p', ...position(ascii) };
}

function tap(ex: PlayMoveExercise, vertex: string) {
  return judgePlayMove(ex, exerciseGame(ex), parseVertex(vertex, ex.size));
}

function keys(judgement: ReturnType<typeof tap>) {
  if (judgement.kind !== 'played') return judgement.reason;
  return judgement.correct ? 'correct' : judgement.lines.map((l) => l.key);
}

describe('play-move judgement and feedback (AC 73–78)', () => {
  //   W e3 has one liberty (d3)
  const e3 = exercise(
    `
    5 . . . . .
    4 . . . . X
    3 . . . . O
    2 . . . . X
    1 . . . . .
      a b c d e
  `,
    { kind: 'capture' },
  );

  it('AC 72–73: d3 captures; c3 captures nothing', () => {
    expect(keys(tap(e3, 'd3'))).toBe('correct');
    expect(keys(tap(e3, 'c3'))).toEqual(['fb.pm.noCapture']);
  });

  it('AC 63: an occupied point is illegal, not an attempt', () => {
    expect(keys(tap(e3, 'e3'))).toBe('occupied');
    expect(illegalFeedback('occupied')).toEqual([{ key: 'engine.illegal.occupied' }]);
    expect(illegalFeedback('suicide')).toEqual([{ key: 'engine.illegal.suicide' }]);
    expect(illegalFeedback('ko')).toEqual([{ key: 'engine.illegal.ko' }]);
  });

  it('AC 74: no capture + self-atari as a second line', () => {
    const fixture = exercise(
      `
      5 . . . O .
      4 . . . . X
      3 . . . . O
      2 . . . . X
      1 . . . . .
        a b c d e
    `,
      { kind: 'capture' },
    );
    // B e5 joins e4: {e4, e5} has only d4 left.
    expect(keys(tap(fixture, 'e5'))).toEqual(['fb.pm.noCapture', 'fb.pm.selfAtari']);
  });

  it('capture min 2 with 1 captured → captureTooFew with n', () => {
    const two = exercise(
      `
      5 . . . . .
      4 . . . . X
      3 . . . . O
      2 . . . . X
      1 . . . . .
        a b c d e
    `,
      { kind: 'capture', min: 2 },
    );
    const judgement = tap(two, 'd3');
    expect(judgement.kind === 'played' && judgement.lines).toEqual([
      { key: 'fb.pm.captureTooFew', params: { n: 1 } },
    ]);
  });

  it('AC 75: connect', () => {
    const e4 = exercise(
      `
      5 . . . . .
      4 . . O . .
      3 . X . X .
      2 . . O . .
      1 . . . . .
        a b c d e
    `,
      { kind: 'connect', a: 'b3', b: 'd3' },
    );
    expect(keys(tap(e4, 'c3'))).toBe('correct');
    expect(keys(tap(e4, 'b4'))).toEqual(['fb.pm.notConnected']);
    expect(keys(tap(e4, 'c4'))).toBe('occupied');
  });

  it('AC 76: atari', () => {
    const atari = exercise(
      `
      5 . . . . .
      4 . . . . .
      3 . . O X .
      2 . . X . .
      1 . . . . .
        a b c d e
    `,
      { kind: 'atari' },
    );
    expect(keys(tap(atari, 'e1'))).toEqual(['fb.pm.noAtari']);
    expect(keys(tap(atari, 'c4'))).toBe('correct');
  });

  it('AC 77: save', () => {
    const save = exercise(
      `
      5 . . . . .
      4 . . O . .
      3 . O X O .
      2 . . . . .
      1 . . . . .
        a b c d e
    `,
      { kind: 'save', target: 'c3' },
    );
    expect(keys(tap(save, 'e5'))).toEqual(['fb.pm.stillAtari']);
    expect(keys(tap(save, 'c2'))).toBe('correct');
  });

  it('AC 78: point', () => {
    const point = exercise(
      `
      5 . . . . .
      4 . . . . .
      3 . . . . .
      2 . . . . .
      1 . . . . .
        a b c d e
    `,
      { kind: 'point', points: ['c3'] },
    );
    expect(keys(tap(point, 'd3'))).toEqual(['fb.pm.wrongPoint']);
    expect(keys(tap(point, 'c3'))).toBe('correct');
  });
});

describe('tap-all (AC 69–70)', () => {
  const answer = ['b1', 'c2', 'd1'];

  it('the exact set is correct', () => {
    expect(judgeTapAll(['d1', 'b1', 'c2'], answer)).toEqual({
      correct: true,
      found: ['d1', 'b1', 'c2'],
      extra: [],
    });
  });

  it('b1 + c3: 1 of 3 found, c3 extra', () => {
    const judgement = judgeTapAll(['b1', 'c3'], answer);
    expect(judgement).toEqual({ correct: false, found: ['b1'], extra: ['c3'] });
    expect(tapAllFeedback(1, 3, 1)).toEqual([
      { key: 'fb.tapAll.partial', params: { found: 1, total: 3 } },
      { key: 'fb.tapAll.extra' },
    ]);
    expect(tapAllFeedback(2, 3, 0)).toHaveLength(1);
  });
});
