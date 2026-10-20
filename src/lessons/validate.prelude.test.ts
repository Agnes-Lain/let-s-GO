// `prelude` on exercises (spec docs/specs/M5-ko-forbidden-ladders.md §5, AC 9–14).
import { checkMove, parseVertex, toVertex } from '@/engine';

import { allTexts, position, sampleLesson, withExercise } from './__fixtures__/fixtures';
import { getSolution, lastPlayedPoint, solutionPoints, startState } from './goals';
import type { Exercise, LessonError } from './schema';
import { validateLesson } from './validate';

/** KO-A: Black b4 d4 c5, White b3 c2 c4 d3 on 5×5. Black c3 captures c4 and starts a ko. */
const KO_A = `
  . . X . .
  . X O X .
  . O . O .
  . . O . .
  . . . . .
`;

function errorsOf(input: unknown): LessonError[] {
  const result = validateLesson(input, allTexts);
  return result.ok ? [] : result.errors;
}

function tapKo(extra: Record<string, unknown> = {}) {
  return {
    id: 'tap-ko',
    type: 'tap-point',
    ...position(KO_A),
    prelude: [{ color: 'B', at: 'c3' }],
    mode: 'one',
    answer: { points: ['c4'] },
    promptKey: 'p',
    hintKey: 'h',
    hintPoints: ['c4'],
    ...extra,
  };
}

describe('prelude: start state (AC 9, 12)', () => {
  it('AC 9: board, side to move and ko ban are those after the prelude', () => {
    const exercise = tapKo() as unknown as Exercise;
    const state = startState(exercise);
    expect(state.toPlay).toBe('W');
    expect(state.koPoint && toVertex(state.koPoint, 5)).toBe('c4');
    expect(checkMove(state, 'c4')).toEqual({ legal: false, reason: 'ko' });
  });

  it('AC 12: the captured stone is gone and the last prelude move is the last move', () => {
    const state = startState(tapKo() as unknown as Exercise);
    const c4 = parseVertex('c4', 5);
    expect(state.board.cells[c4.y * 5 + c4.x]).toBeNull();
    expect(lastPlayedPoint(state)).toEqual(parseVertex('c3', 5));
  });

  it('without a prelude, there is no last move and toPlay is honoured', () => {
    const state = startState({ ...position(KO_A) }, 'W');
    expect(state.toPlay).toBe('W');
    expect(lastPlayedPoint(state)).toBeNull();
  });

  it('getSolution and solutionPoints read the position after the prelude', () => {
    const count = {
      id: 'c',
      type: 'count',
      ...position(KO_A),
      prelude: [{ color: 'B', at: 'c3' }],
      answer: { libertiesOf: 'c3' },
      promptKey: 'p',
    } as unknown as Exercise;
    // After B c3 captures c4, the stone on c3 has exactly one liberty: c4.
    expect(getSolution(count)).toEqual({ value: 1 });
    expect(solutionPoints(count)).toEqual(['c4']);
  });
});

describe('prelude: validation (AC 9–11, 14)', () => {
  it('AC 9: a tap-point whose answer is occupied in the setup but empty after the prelude is valid', () => {
    expect(errorsOf(withExercise(0, tapKo()))).toEqual([]);
  });

  it('AC 10: an illegal prelude move is PRELUDE_ILLEGAL with the path of the move', () => {
    const lesson = withExercise(
      0,
      tapKo({
        prelude: [
          { color: 'B', at: 'c3' },
          { color: 'W', at: 'c4' },
        ],
      }),
    );
    const errors = errorsOf(lesson);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: 'PRELUDE_ILLEGAL', path: 'exercises[0].prelude[1]' });
    expect(errors[0].message).toContain('ko');
  });

  it('AC 10: a prelude move on an occupied point is PRELUDE_ILLEGAL', () => {
    const errors = errorsOf(withExercise(0, tapKo({ prelude: [{ color: 'B', at: 'b4' }] })));
    expect(errors.map((e) => [e.code, e.path])).toEqual([
      ['PRELUDE_ILLEGAL', 'exercises[0].prelude[0]'],
    ]);
  });

  it('AC 11: a play-move whose toPlay is not the side to move after the prelude is PRELUDE_TURN', () => {
    const exercise = {
      id: 'pm',
      type: 'play-move',
      ...position(KO_A),
      prelude: [{ color: 'B', at: 'c3' }],
      toPlay: 'B',
      goal: { kind: 'capture' },
      promptKey: 'p',
    };
    const errors = errorsOf(withExercise(0, exercise));
    expect(errors.map((e) => [e.code, e.path])).toEqual([['PRELUDE_TURN', 'exercises[0].toPlay']]);
  });

  it('AC 11: a play-move with the right toPlay keeps the ko ban (the ko point is no solution)', () => {
    const exercise = {
      id: 'pm',
      type: 'play-move',
      ...position(KO_A),
      prelude: [{ color: 'B', at: 'c3' }],
      toPlay: 'W',
      goal: { kind: 'point', points: ['c4'] },
      promptKey: 'p',
    };
    const errors = errorsOf(withExercise(0, exercise));
    expect(errors.map((e) => e.code)).toEqual(['GOAL_POINT_ILLEGAL']);
  });

  it('AC 11: choice, tap-point and count need no toPlay', () => {
    const choice = {
      id: 'ch',
      type: 'choice',
      ...position(KO_A),
      prelude: [{ color: 'B', at: 'c3' }],
      options: [{ textKey: 'a', correct: true }, { textKey: 'b' }],
      promptKey: 'p',
    };
    expect(errorsOf(withExercise(0, choice))).toEqual([]);
  });

  it('a prelude must be a non-empty list of moves', () => {
    expect(errorsOf(withExercise(0, tapKo({ prelude: [] }))).map((e) => e.code)).toEqual([
      'BAD_TYPE',
    ]);
    expect(
      errorsOf(withExercise(0, tapKo({ prelude: [{ color: 'B', at: 'c3', x: 1 }] }))).map(
        (e) => e.code,
      ),
    ).toEqual(['UNKNOWN_FIELD']);
  });

  it('a play-bot game has no prelude', () => {
    const lesson = sampleLesson();
    const bot = {
      id: 'g',
      type: 'play-bot',
      ...position(`
        . . . . .
        . . . . .
        . . . . .
        . . . . .
        . . . . .
      `),
      prelude: [{ color: 'B', at: 'c3' }],
      win: { kind: 'captureN', n: 1 },
      bot: { level: 1 },
      promptKey: 'p',
    };
    lesson.exercises[0] = bot;
    expect(errorsOf(lesson).map((e) => [e.code, e.path])).toContainEqual([
      'UNKNOWN_FIELD',
      'exercises[0].prelude',
    ]);
  });

  it('AC 14: an explanation step may not have a prelude', () => {
    const lesson = sampleLesson();
    lesson.explain[0].prelude = [{ color: 'B', at: 'c3' }];
    expect(errorsOf(lesson).map((e) => [e.code, e.path])).toEqual([
      ['UNKNOWN_FIELD', 'explain[0].prelude'],
    ]);
  });
});
