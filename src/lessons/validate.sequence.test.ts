// `sequence` exercises in the validator (spec docs/specs/M5-sgf-import.md §6, AC 21–28).
import { position, sampleLesson, withExercise, allTexts } from './__fixtures__/fixtures';
import { EXERCISE_TYPES, type LessonError, type ValidationContext } from './schema';
import { validateLesson } from './validate';

/**
 * F1 — capture in one. Black c2 captures c3.
 *   5 . . . . .
 *   4 . . X . .
 *   3 . X O X .
 *   2 . . * . .
 *   1 . . . . .
 */
const F1_BOARD = `
  . . . . .
  . . X . .
  . X O X .
  . . . . .
  . . . . .
`;

/**
 * F2 — ladder (7 plies): B c4, W d3, B e3, W d4, B d5, W e4, B e5 captures four stones.
 *   5 . . . . .
 *   4 . . . . .
 *   3 . X O . .
 *   2 . . X X .
 *   1 . . . . .
 */
const F2_BOARD = `
  . . . . .
  . . . . .
  . X O . .
  . . X X .
  . . . . .
`;

/** KO-A: Black c3 captures c4 and starts a ko; White may not retake at c4 at once. */
const KO_A = `
  . . X . .
  . X O X .
  . O . O .
  . . O . .
  . . . . .
`;

const B = (at: string) => ({ color: 'B', at });
const W = (at: string) => ({ color: 'W', at });

function f1(extra: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    type: 'sequence',
    ...position(F1_BOARD),
    toPlay: 'B',
    goal: { kind: 'capture', target: 'c3' },
    line: [B('c2')],
    wrong: [{ line: [B('a1')], whyKey: 'why' }],
    promptKey: 'p',
    hintKey: 'h',
    hintPoints: ['c2'],
    explainKey: 'e',
    ...extra,
  };
}

function f2(extra: Record<string, unknown> = {}) {
  return {
    id: 'f2',
    type: 'sequence',
    ...position(F2_BOARD),
    toPlay: 'B',
    goal: { kind: 'capture', target: 'c3' },
    line: [B('c4'), W('d3'), B('e3'), W('d4'), B('d5'), W('e4'), B('e5')],
    wrong: [{ line: [B('d3'), W('c4')] }],
    promptKey: 'p',
    ...extra,
  };
}

function errorsOf(
  exercise: Record<string, unknown>,
  ctx: ValidationContext = allTexts,
): LessonError[] {
  const result = validateLesson(withExercise(0, exercise), ctx);
  return result.ok ? [] : result.errors;
}

function codesOf(exercise: Record<string, unknown>): string[] {
  return errorsOf(exercise).map((e) => e.code);
}

describe('sequence: accepted (AC 21, 24, 28)', () => {
  it('AC 28: EXERCISE_TYPES includes sequence', () => {
    expect(EXERCISE_TYPES).toContain('sequence');
  });

  it.each([
    ['F1', f1()],
    ['F2', f2()],
  ])('AC 21: %s is a valid sequence exercise', (_name, exercise) => {
    expect(errorsOf(exercise)).toEqual([]);
  });

  it("goal 'line' needs only a legal line", () => {
    expect(errorsOf(f2({ goal: { kind: 'line' }, line: [B('c4'), W('d3')] }))).toEqual([]);
  });

  it('wrong is optional', () => {
    const exercise: Record<string, unknown> = f1();
    delete exercise.wrong;
    expect(errorsOf(exercise)).toEqual([]);
  });

  it('AC 28: the 5–10 exercise rule applies unchanged', () => {
    const lesson = sampleLesson();
    lesson.exercises = [f1({ id: 'a' }), f1({ id: 'b' }), f1({ id: 'c' }), f1({ id: 'd' })];
    const result = validateLesson(lesson, allTexts);
    expect(result.ok ? [] : result.errors.map((e) => e.code)).toEqual(['BAD_EXERCISE_COUNT']);
  });
});

describe('sequence: shape', () => {
  it.each([['toPlay'], ['goal'], ['line']])('"%s" is required', (field) => {
    const exercise: Record<string, unknown> = f1();
    delete exercise[field];
    expect(codesOf(exercise)).toContain('MISSING_FIELD');
  });

  it('an empty line is BAD_TYPE', () => {
    expect(errorsOf(f1({ line: [] }))).toEqual([
      expect.objectContaining({ code: 'BAD_TYPE', path: 'exercises[0].line' }),
    ]);
  });

  it('an empty wrong line is BAD_TYPE', () => {
    expect(errorsOf(f1({ wrong: [{ line: [] }] }))).toEqual([
      expect.objectContaining({ code: 'BAD_TYPE', path: 'exercises[0].wrong[0].line' }),
    ]);
  });

  it('an unknown goal kind is BAD_TYPE', () => {
    expect(errorsOf(f1({ goal: { kind: 'alive' } }))).toEqual([
      expect.objectContaining({ code: 'BAD_TYPE', path: 'exercises[0].goal.kind' }),
    ]);
  });

  it('unknown fields in a wrong branch are reported', () => {
    expect(errorsOf(f1({ wrong: [{ line: [B('a1')], why: 'x' }] }))).toEqual([
      expect.objectContaining({ code: 'UNKNOWN_FIELD', path: 'exercises[0].wrong[0].why' }),
    ]);
  });

  it('the sgf source field never reaches a lesson', () => {
    expect(errorsOf(f1({ sgf: 'e1.sgf' }))).toEqual([
      expect.objectContaining({ code: 'UNKNOWN_FIELD', path: 'exercises[0].sgf' }),
    ]);
  });
});

describe('sequence: SEQ_BAD_ORDER (AC 22)', () => {
  it('line[0] of the other colour', () => {
    expect(errorsOf(f1({ line: [W('c2')] }))).toEqual([
      expect.objectContaining({ code: 'SEQ_BAD_ORDER', path: 'exercises[0].line[0]' }),
    ]);
  });

  it('colours that do not alternate', () => {
    expect(errorsOf(f2({ line: [B('c4'), B('d3')] }))).toEqual([
      expect.objectContaining({ code: 'SEQ_BAD_ORDER', path: 'exercises[0].line[1]' }),
    ]);
  });

  it('a wrong line of the other colour', () => {
    expect(errorsOf(f1({ wrong: [{ line: [W('a1')] }] }))).toEqual([
      expect.objectContaining({ code: 'SEQ_BAD_ORDER', path: 'exercises[0].wrong[0].line[0]' }),
    ]);
  });
});

describe('sequence: SEQ_ILLEGAL_MOVE (AC 23)', () => {
  it('an occupied point, with the engine reason', () => {
    const [error] = errorsOf(f1({ line: [B('b3')], goal: { kind: 'line' }, hintPoints: ['b3'] }));
    expect(error).toMatchObject({ code: 'SEQ_ILLEGAL_MOVE', path: 'exercises[0].line[0]' });
    expect(error.message).toContain('occupied');
  });

  it('suicide in a wrong line', () => {
    //   5 . . . . .
    //   4 . . X . .
    //   3 . X O X .
    //   2 O . . . .
    //   1 * O . . .     B a1 is suicide
    const board = `
      . . . . .
      . . X . .
      . X O X .
      O . . . .
      . O . . .
    `;
    const [error] = errorsOf(f1({ ...position(board), wrong: [{ line: [B('a1')] }] }));
    expect(error).toMatchObject({
      code: 'SEQ_ILLEGAL_MOVE',
      path: 'exercises[0].wrong[0].line[0]',
    });
    expect(error.message).toContain('suicide');
  });

  it('an immediate ko retake', () => {
    const exercise: Record<string, unknown> = f1({
      ...position(KO_A),
      goal: { kind: 'line' },
      line: [B('c3'), W('c4')],
      hintPoints: ['c3'],
    });
    delete exercise.wrong;
    const [error] = errorsOf(exercise);
    expect(error).toMatchObject({ code: 'SEQ_ILLEGAL_MOVE', path: 'exercises[0].line[1]' });
    expect(error.message).toContain('ko');
  });
});

describe('sequence: goals (AC 24)', () => {
  it('capture goal not met by the line', () => {
    expect(errorsOf(f1({ line: [B('a1')], wrong: [], hintPoints: ['a1'] }))).toEqual([
      expect.objectContaining({ code: 'SEQ_GOAL_NOT_MET', path: 'exercises[0].goal' }),
    ]);
  });

  it.each([
    ['a stone of the side to play', 'b3'],
    ['an empty point', 'a1'],
  ])('a target that is %s is SEQ_BAD_TARGET', (_what, target) => {
    expect(errorsOf(f1({ goal: { kind: 'capture', target } }))).toEqual([
      expect.objectContaining({ code: 'SEQ_BAD_TARGET', path: 'exercises[0].goal.target' }),
    ]);
  });

  it('a target that is not a vertex is BAD_VERTEX', () => {
    expect(codesOf(f1({ goal: { kind: 'capture', target: 'z9' } }))).toEqual(['BAD_VERTEX']);
  });
});

describe('sequence: SEQ_DUPLICATE_BRANCH (AC 25)', () => {
  it('a wrong line that starts with the correct move', () => {
    expect(errorsOf(f1({ wrong: [{ line: [B('c2')] }] }))).toEqual([
      expect.objectContaining({ code: 'SEQ_DUPLICATE_BRANCH', path: 'exercises[0].wrong[0]' }),
    ]);
  });

  it('two wrong lines with the same first move', () => {
    expect(errorsOf(f1({ wrong: [{ line: [B('a1')] }, { line: [B('a1'), W('c2')] }] }))).toEqual([
      expect.objectContaining({ code: 'SEQ_DUPLICATE_BRANCH', path: 'exercises[0].wrong[1]' }),
    ]);
  });
});

describe('sequence: hints and texts (AC 26)', () => {
  it('hintPoints outside line[0].at is BAD_HINT', () => {
    expect(errorsOf(f1({ hintPoints: ['a1'] }))).toEqual([
      expect.objectContaining({ code: 'BAD_HINT', path: 'exercises[0].hintPoints' }),
    ]);
  });

  it('a missing whyKey text is MISSING_TEXT', () => {
    const ctx = { hasText: (key: string) => key !== 'why' };
    expect(errorsOf(f1(), ctx)).toEqual([
      expect.objectContaining({ code: 'MISSING_TEXT', path: 'exercises[0].wrong[0].whyKey' }),
    ]);
  });

  it('a missing promptKey text is MISSING_TEXT', () => {
    const ctx = { hasText: (key: string) => key !== 'p' };
    expect(errorsOf(f1(), ctx).map((e) => e.path)).toContain('exercises[0].promptKey');
  });
});

describe('sequence: prelude (AC 27)', () => {
  /** KO-A after the prelude B c3: White to play, c4 is the ko point. */
  function koExercise(extra: Record<string, unknown>) {
    return {
      id: 'ko',
      type: 'sequence',
      ...position(KO_A),
      prelude: [B('c3')],
      toPlay: 'W',
      goal: { kind: 'line' },
      promptKey: 'p',
      ...extra,
    };
  }

  it('the line is checked from the position after the prelude', () => {
    expect(errorsOf(koExercise({ line: [W('a1'), B('c4')] }))).toEqual([]);
  });

  it('a ko retake right after the prelude is SEQ_ILLEGAL_MOVE', () => {
    expect(errorsOf(koExercise({ line: [W('c4')] }))).toEqual([
      expect.objectContaining({ code: 'SEQ_ILLEGAL_MOVE', path: 'exercises[0].line[0]' }),
    ]);
  });

  it('toPlay must be the side to move after the prelude', () => {
    expect(codesOf(koExercise({ toPlay: 'B', line: [B('a1')] }))).toEqual(['PRELUDE_TURN']);
  });

  it('a capture target is read after the prelude', () => {
    // After B c3 captures c4, the white stone at c4 is gone: it cannot be a target.
    expect(
      errorsOf(koExercise({ goal: { kind: 'capture', target: 'c4' }, line: [W('a1')] })),
    ).toEqual([
      expect.objectContaining({ code: 'SEQ_BAD_TARGET', path: 'exercises[0].goal.target' }),
    ]);
  });
});
