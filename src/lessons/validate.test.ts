import { allTexts, position, sampleLesson, withExercise } from './__fixtures__/fixtures';
import type { Lesson, LessonError, ValidationContext } from './schema';
import { MAX_ERRORS, validateCatalog, validateLesson } from './validate';

function errorsOf(input: unknown, ctx: ValidationContext = allTexts): LessonError[] {
  const result = validateLesson(input, ctx);
  return result.ok ? [] : result.errors;
}

function codes(input: unknown, ctx: ValidationContext = allTexts): string[] {
  return errorsOf(input, ctx).map((e) => e.code);
}

/** A play-move exercise on an ASCII board. */
function playMove(
  ascii: string,
  goal: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  return {
    id: 'pm',
    type: 'play-move',
    toPlay: 'B',
    ...position(ascii),
    goal,
    promptKey: 'p',
    ...extra,
  };
}

describe('validateLesson: the sample (AC 1)', () => {
  it('is valid and has 3 steps and 6 exercises', () => {
    const result = validateLesson(sampleLesson(), allTexts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lesson.exercises).toHaveLength(6);
    expect(result.lesson.explain).toHaveLength(3);
  });
});

describe('shape errors (AC 2–7)', () => {
  it.each([null, [], 'x', 3])('AC 2: %j is NOT_OBJECT with path ""', (input) => {
    expect(errorsOf(input)).toEqual([
      { code: 'NOT_OBJECT', path: '', message: 'lesson must be a JSON object' },
    ]);
  });

  it('AC 3: unknown fields at the top and in an exercise', () => {
    const lesson = sampleLesson();
    lesson.foo = 1;
    lesson.exercises[0].hnt = 'x';
    const errors = errorsOf(lesson);
    expect(errors).toEqual(
      expect.arrayContaining([
        { code: 'UNKNOWN_FIELD', path: 'foo', message: 'unknown field "foo" (typo?)' },
        expect.objectContaining({ code: 'UNKNOWN_FIELD', path: 'exercises[0].hnt' }),
      ]),
    );
    expect(validateLesson(lesson, allTexts).ok).toBe(false);
  });

  it('a missing required field is MISSING_FIELD', () => {
    const lesson = sampleLesson();
    delete lesson.titleKey;
    expect(errorsOf(lesson)).toEqual([
      { code: 'MISSING_FIELD', path: 'titleKey', message: '"titleKey" is required' },
    ]);
  });

  it('AC 4: schema, id, unit', () => {
    expect(codes({ ...sampleLesson(), schema: 2 })).toEqual(['BAD_SCHEMA']);
    expect(errorsOf({ ...sampleLesson(), schema: 2 })[0].message).toBe(
      'unsupported schema version 2; expected 1',
    );
    expect(codes({ ...sampleLesson(), id: 'Capture' })).toEqual(['BAD_ID']);
    expect(codes({ ...sampleLesson(), id: 'u05-x', unit: 4 })).toEqual(['ID_UNIT_MISMATCH']);
    expect(errorsOf({ ...sampleLesson(), id: 'u05-x', unit: 4 })[0].message).toBe(
      'id "u05-x" must start with "u04" to match unit 4',
    );
    expect(codes({ ...sampleLesson(), id: 'u17-x', unit: 17 })).toEqual(['BAD_UNIT']);
    expect(codes({ ...sampleLesson(), unit: 0, id: 'u00-sample' })).toEqual([]);
    expect(codes({ ...sampleLesson(), unit: 1.5 })).toEqual(['BAD_UNIT']);
  });

  it('kind must be lesson or checkpoint', () => {
    expect(codes({ ...sampleLesson(), kind: 'quiz' })).toEqual(['BAD_KIND']);
  });

  it('AC 5: step counts', () => {
    const one = sampleLesson();
    one.explain = one.explain.slice(0, 1);
    expect(errorsOf(one)).toEqual([
      {
        code: 'BAD_STEP_COUNT',
        path: 'explain',
        message: 'explain must have 2 to 4 steps, found 1',
      },
    ]);

    const five = sampleLesson();
    five.explain = [...five.explain, five.explain[2], five.explain[2]];
    expect(codes(five)).toEqual(['BAD_STEP_COUNT']);

    const checkpointWithStep = { ...one, kind: 'checkpoint' };
    expect(errorsOf(checkpointWithStep)).toEqual([
      { code: 'BAD_STEP_COUNT', path: 'explain', message: 'a checkpoint has no explain steps' },
    ]);

    const checkpoint = sampleLesson();
    checkpoint.kind = 'checkpoint';
    delete checkpoint.explain;
    expect(codes(checkpoint)).toEqual([]);
    expect(codes({ ...checkpoint, explain: [] })).toEqual([]);
  });

  it('AC 6: exercise counts', () => {
    const four = sampleLesson();
    four.exercises = four.exercises.slice(0, 4);
    expect(errorsOf(four)).toEqual([
      {
        code: 'BAD_EXERCISE_COUNT',
        path: 'exercises',
        message: 'exercises must have 5 to 10 items, found 4',
      },
    ]);
    const eleven = sampleLesson();
    eleven.exercises = Array.from({ length: 11 }, (_, i) => ({
      ...eleven.exercises[0],
      id: `e${i}`,
    }));
    expect(codes(eleven)).toEqual(['BAD_EXERCISE_COUNT']);
  });

  it('AC 7: the first step needs a board; later ones inherit', () => {
    const lesson = sampleLesson();
    delete lesson.explain[0].board;
    expect(errorsOf(lesson)).toEqual([
      expect.objectContaining({ code: 'STEP_NO_BOARD', path: 'explain[0]' }),
    ]);
    expect(sampleLesson().explain[1].board).toBeUndefined(); // the sample's step 2 is valid
  });
});

describe('boards and setups (AC 8–10)', () => {
  it.each([11, 13])('AC 8: size %d is BAD_SIZE', (size) => {
    const lesson = sampleLesson();
    lesson.exercises[0].size = size;
    expect(errorsOf(lesson)).toEqual([
      {
        code: 'BAD_SIZE',
        path: 'exercises[0].size',
        message: `board size ${size} is not supported (use 5, 7 or 9)`,
      },
    ]);
  });

  it('AC 8: f6 on a 5×5 board is BAD_VERTEX with the path of the vertex', () => {
    const lesson = sampleLesson();
    lesson.exercises[0].setup.B[1] = 'f6';
    expect(errorsOf(lesson)).toEqual([
      {
        code: 'BAD_VERTEX',
        path: 'exercises[0].setup.B[1]',
        message: '"f6" is not a point on a 5×5 board (columns a–e, no "i"; rows 1–5)',
      },
    ]);
  });

  it.each(['i3', 'a0', 'k3', 'C3', 3])('AC 8: %j on 9×9 is BAD_VERTEX', (vertex) => {
    const ex = playMove(
      `
      . . . . . . . . .
      . . . . . . . . .
      . . . . . . . . .
      . . . . . . . . .
      . . . . . . . . .
      . . . . . . . . .
      . . . . X . . . .
      . . . X O X . . .
      . . . . . . . . .
    `,
      { kind: 'capture' },
    );
    ex.setup.W = ['e2', vertex as string];
    const errors = errorsOf(withExercise(2, ex));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: 'BAD_VERTEX', path: 'exercises[2].setup.W[1]' });
    expect(errors[0].message).toContain('columns a–j, no "i"; rows 1–9');
  });

  it('AC 9: the same point twice is SETUP_OVERLAP', () => {
    const lesson = sampleLesson();
    lesson.exercises[1].setup = { B: ['c3'], W: ['c3'] };
    lesson.exercises[1].answer = { points: ['a1'] };
    expect(errorsOf(lesson)).toEqual([
      {
        code: 'SETUP_OVERLAP',
        path: 'exercises[1].setup.W[0]',
        message: '"c3" appears more than once in the setup',
      },
    ]);
  });

  it('AC 9: a setup group without liberties is SETUP_DEAD_GROUP', () => {
    const lesson = sampleLesson();
    // 2 X . . . .
    // 1 O X . . .
    lesson.exercises[1].setup = { W: ['a1'], B: ['a2', 'b1'] };
    lesson.exercises[1].answer = { points: ['c3'] };
    expect(errorsOf(lesson)).toEqual([
      {
        code: 'SETUP_DEAD_GROUP',
        path: 'exercises[1].setup',
        message: 'the stones around "a1" have no liberties in the starting position',
      },
    ]);
  });

  //   5 . . . . .
  //   4 . . . . .
  //   3 . X O X .
  //   2 . . X . .
  //   1 . . . . .
  const capturePosition = position(`
    5 . . . . .
    4 . . . . .
    3 . X O X .
    2 . . X . .
    1 . . . . .
      a b c d e
  `);

  it('AC 10: an explain move on an occupied point is MOVE_ILLEGAL', () => {
    const lesson = sampleLesson();
    lesson.explain[0] = {
      board: capturePosition,
      moves: [{ color: 'W', at: 'c3' }],
      textKey: 't',
    };
    const errors = errorsOf(lesson);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: 'MOVE_ILLEGAL', path: 'explain[0].moves[0]' });
    expect(errors[0].message).toBe('move W c3 is illegal here: occupied');
  });

  it('AC 10: a legal capturing explain move is valid', () => {
    const lesson = sampleLesson();
    lesson.explain[0] = {
      board: capturePosition,
      moves: [{ color: 'B', at: 'c4' }],
      textKey: 't',
    };
    lesson.explain[1] = lesson.explain[2]; // the sample's step 2 would replay c4
    expect(codes(lesson)).toEqual([]);
  });

  it('a step without a board continues from the end of the previous one', () => {
    // Step 2 of the sample plays B c4 (captures c3); B c3 is then legal on step 3 without a board.
    const lesson = sampleLesson();
    lesson.explain[2] = { moves: [{ color: 'B', at: 'c3' }], textKey: 't' };
    expect(codes(lesson)).toEqual([]);
    lesson.explain[2] = { moves: [{ color: 'B', at: 'c4' }], textKey: 't' };
    expect(codes(lesson)).toEqual(['MOVE_ILLEGAL']);
  });

  it('labels need 1–2 characters', () => {
    const lesson = sampleLesson();
    lesson.exercises[4].markers[0].text = 'ABC';
    lesson.exercises[4].markers[1].text = '';
    expect(codes(lesson)).toEqual(['BAD_LABEL', 'BAD_LABEL']);
  });
});

describe('texts (AC 11)', () => {
  const texts: Record<string, Record<string, string>> = {
    'zh-CN': {},
    en: {},
    fr: {},
  };
  const keys = JSON.stringify(sampleLesson()).match(/lesson\.u00-sample\.[\w.]+/g) ?? [];
  for (const lang of Object.keys(texts)) for (const key of keys) texts[lang][key] = 'text';
  const hasText = (key: string, lang: string) => (texts[lang][key] ?? '') !== '';

  afterEach(() => {
    texts.fr['lesson.u00-sample.e1.hint'] = 'text';
    texts.en['lesson.u00-sample.e1.hint'] = 'text';
    texts['zh-CN']['lesson.u00-sample.e1.hint'] = 'text';
  });

  it('all keys present → valid', () => {
    expect(codes(sampleLesson(), { hasText })).toEqual([]);
  });

  it('missing in fr only → MISSING_TEXT listing fr', () => {
    delete texts.fr['lesson.u00-sample.e1.hint'];
    expect(errorsOf(sampleLesson(), { hasText })).toEqual([
      {
        code: 'MISSING_TEXT',
        path: 'exercises[0].hintKey',
        message: 'text "lesson.u00-sample.e1.hint" is missing in: fr',
      },
    ]);
  });

  it('an empty string counts as missing; missing everywhere lists all three', () => {
    texts.fr['lesson.u00-sample.e1.hint'] = '';
    delete texts.en['lesson.u00-sample.e1.hint'];
    delete texts['zh-CN']['lesson.u00-sample.e1.hint'];
    expect(errorsOf(sampleLesson(), { hasText })[0].message).toBe(
      'text "lesson.u00-sample.e1.hint" is missing in: zh-CN, en, fr',
    );
  });

  it('without ctx the text rule is skipped', () => {
    expect(validateLesson({ ...sampleLesson(), titleKey: 'nowhere' }).ok).toBe(true);
  });
});

describe('tap-point (AC 12)', () => {
  it('an empty answer is EMPTY_ANSWER', () => {
    const lesson = sampleLesson();
    lesson.exercises[0].answer = { points: [] };
    delete lesson.exercises[0].hintPoints;
    expect(errorsOf(lesson)).toEqual([
      { code: 'EMPTY_ANSWER', path: 'exercises[0].answer.points', message: 'answer has no points' },
    ]);
  });

  it('libertiesOf an empty point is TARGET_NOT_STONE', () => {
    const lesson = sampleLesson();
    lesson.exercises[1].answer = { libertiesOf: 'a1' };
    expect(errorsOf(lesson)).toEqual([
      {
        code: 'TARGET_NOT_STONE',
        path: 'exercises[1].answer.libertiesOf',
        message: '"a1" must be a stone',
      },
    ]);
  });

  it('mode must be one or all', () => {
    const lesson = sampleLesson();
    lesson.exercises[0].mode = 'some';
    expect(codes(lesson)).toEqual(['BAD_TYPE']);
  });
});

describe('play-move goals (AC 13–18)', () => {
  // e3 exercise: W e3 has one liberty, d3.
  const e3 = `
    5 . . . . .
    4 . . . . X
    3 . . . . O
    2 . . . . X
    1 . . . . .
      a b c d e
  `;

  it('AC 13: capture min 2 has no solution', () => {
    expect(errorsOf(withExercise(2, playMove(e3, { kind: 'capture', min: 2 })))).toEqual([
      {
        code: 'NO_SOLUTION',
        path: 'exercises[2].goal',
        message: 'no legal move for B meets goal "capture"',
      },
    ]);
  });

  it('AC 14: atari on a 3-liberty stone has no solution; with 2 liberties it has', () => {
    const three = `
      5 . . . . .
      4 . . . . .
      3 . . O . .
      2 . . X . .
      1 . . . . .
        a b c d e
    `;
    expect(codes(withExercise(2, playMove(three, { kind: 'atari' })))).toEqual(['NO_SOLUTION']);
    const two = `
      5 . . . . .
      4 . . . . .
      3 . . O X .
      2 . . X . .
      1 . . . . .
        a b c d e
    `;
    expect(codes(withExercise(2, playMove(two, { kind: 'atari' })))).toEqual([]);
  });

  it('AC 15: connect already one group / different colours', () => {
    const joined = `
      5 . . . . .
      4 . . . . .
      3 . X X X .
      2 . . . . .
      1 . . . . .
        a b c d e
    `;
    expect(
      errorsOf(withExercise(3, playMove(joined, { kind: 'connect', a: 'b3', b: 'd3' }))),
    ).toEqual([
      {
        code: 'ALREADY_TRUE',
        path: 'exercises[3].goal',
        message: 'goal "connect" is already true in the starting position',
      },
    ]);
    const mixed = `
      5 . . . . .
      4 . . . . .
      3 . X . O .
      2 . . . . .
      1 . . . . .
        a b c d e
    `;
    expect(
      errorsOf(withExercise(3, playMove(mixed, { kind: 'connect', a: 'b3', b: 'd3' }))),
    ).toEqual([
      {
        code: 'GOAL_SAME_COLOR',
        path: 'exercises[3].goal',
        message: '"b3" and "d3" must be the same colour',
      },
    ]);
  });

  it('AC 16: save — one solution, already safe, wrong colour', () => {
    const inAtari = `
      5 . . . . .
      4 . . O . .
      3 . O X O .
      2 . . . . .
      1 . . . . .
        a b c d e
    `;
    expect(codes(withExercise(3, playMove(inAtari, { kind: 'save', target: 'c3' })))).toEqual([]);

    const safe = `
      5 . . . . .
      4 . . . . .
      3 . . X . .
      2 . . . . .
      1 . . . . .
        a b c d e
    `;
    expect(errorsOf(withExercise(3, playMove(safe, { kind: 'save', target: 'c3' })))).toEqual([
      {
        code: 'ALREADY_TRUE',
        path: 'exercises[3].goal',
        message: 'goal "save" is already true in the starting position',
      },
    ]);

    expect(errorsOf(withExercise(3, playMove(inAtari, { kind: 'save', target: 'b3' })))).toEqual([
      {
        code: 'GOAL_SAME_COLOR',
        path: 'exercises[3].goal.target',
        message: '"b3" must be a B stone',
      },
    ]);
  });

  it('AC 17: goal point', () => {
    const board = `
      5 . . . . .
      4 . . . . .
      3 . . X . O
      2 . . . . .
      1 . . . . .
        a b c d e
    `;
    expect(
      errorsOf(withExercise(3, playMove(board, { kind: 'point', points: ['c3', 'd3'] }))),
    ).toEqual([
      {
        code: 'GOAL_POINT_ILLEGAL',
        path: 'exercises[3].goal.points[0]',
        message: 'goal point "c3" is not a legal move',
      },
    ]);
    expect(codes(withExercise(3, playMove(board, { kind: 'point', points: ['d3'] })))).toEqual([]);
    expect(codes(withExercise(3, playMove(board, { kind: 'point', points: [] })))).toEqual([
      'EMPTY_ANSWER',
    ]);
  });

  it('AC 18: hintPoints outside the solution are BAD_HINT', () => {
    const lesson = sampleLesson();
    lesson.exercises[2].hintPoints = ['b3'];
    expect(errorsOf(lesson)).toEqual([
      {
        code: 'BAD_HINT',
        path: 'exercises[2].hintPoints',
        message: 'hintPoints must be among the solution points d3',
      },
    ]);
  });

  it('toPlay must be B or W and the goal kind must be known', () => {
    expect(codes(withExercise(2, playMove(e3, { kind: 'capture' }, { toPlay: 'X' })))).toEqual([
      'BAD_TYPE',
    ]);
    expect(codes(withExercise(2, playMove(e3, { kind: 'win' })))).toEqual(['BAD_TYPE']);
    expect(codes(withExercise(2, playMove(e3, { kind: 'capture', max: 1 })))).toEqual([
      'UNKNOWN_FIELD',
    ]);
  });

  it('connect / save targets must be stones', () => {
    expect(codes(withExercise(3, playMove(e3, { kind: 'save', target: 'a1' })))).toEqual([
      'TARGET_NOT_STONE',
    ]);
  });
});

describe('choice and count (AC 19–22)', () => {
  it('AC 19: option counts', () => {
    const one = sampleLesson();
    one.exercises[4].options = [one.exercises[4].options[2]];
    expect(codes(one)).toEqual(['BAD_OPTION_COUNT']);
    expect(errorsOf(one)[0].message).toBe('a choice needs 2 to 4 options, found 1');

    const two = sampleLesson();
    two.exercises[4].options[0].correct = true;
    expect(errorsOf(two)).toEqual([
      {
        code: 'BAD_CORRECT_COUNT',
        path: 'exercises[4].options',
        message: 'exactly one option must have "correct": true, found 2',
      },
    ]);
    const none = sampleLesson();
    delete none.exercises[4].options[2].correct;
    expect(codes(none)).toEqual(['BAD_CORRECT_COUNT']);
  });

  it.each([10, -1, 2.5])('AC 20: count answer %d is BAD_COUNT_ANSWER', (answer) => {
    const lesson = sampleLesson();
    lesson.exercises[5].answer = answer;
    expect(errorsOf(lesson)).toEqual([
      {
        code: 'BAD_COUNT_ANSWER',
        path: 'exercises[5].answer',
        message: `count answer must be an integer from 0 to 9, got ${answer}`,
      },
    ]);
  });

  it('AC 20: libertiesOf that resolves to more than 9 is BAD_COUNT_ANSWER', () => {
    const lesson = sampleLesson();
    lesson.exercises[5].setup = { B: ['c4', 'd4', 'e4', 'f4'] };
    lesson.exercises[5].markers = [];
    expect(codes(lesson)).toEqual(['BAD_COUNT_ANSWER']);
  });

  it('AC 21: two exercises with the same id', () => {
    const lesson = sampleLesson();
    lesson.exercises[1].id = lesson.exercises[0].id;
    expect(errorsOf(lesson)).toEqual([
      {
        code: 'DUPLICATE_ID',
        path: 'exercises[1].id',
        message: 'exercise id "tap-last-liberty" is used twice',
      },
    ]);
  });

  it('AC 22: unknown exercise type', () => {
    const lesson = sampleLesson();
    lesson.exercises[0].type = 'tsumego';
    expect(errorsOf(lesson)).toEqual([
      {
        code: 'UNKNOWN_TYPE',
        path: 'exercises[0].type',
        message: 'unknown exercise type "tsumego"',
      },
    ]);
  });
});

describe('all errors are reported (AC 23)', () => {
  it('three independent mistakes give three errors', () => {
    const lesson = sampleLesson();
    lesson.schema = 2;
    lesson.exercises[0].hnt = 'x';
    lesson.exercises[5].answer = 12;
    const errors = errorsOf(lesson);
    expect(errors.map((e) => e.code)).toEqual(['BAD_SCHEMA', 'UNKNOWN_FIELD', 'BAD_COUNT_ANSWER']);
    for (const error of errors) {
      expect(error.code).not.toBe('');
      expect(error.path).not.toBe('');
      expect(error.message).not.toBe('');
    }
  });

  it(`never returns more than ${MAX_ERRORS} errors`, () => {
    const lesson = sampleLesson();
    for (let i = 0; i < 80; i++) lesson[`junk${i}`] = i;
    expect(errorsOf(lesson)).toHaveLength(MAX_ERRORS);
  });
});

describe('validateCatalog (AC 24)', () => {
  const base = sampleLesson() as Lesson;
  const lesson = (id: string, unit: number, kind: Lesson['kind'] = 'lesson'): Lesson => ({
    ...base,
    id,
    unit,
    kind,
  });

  it('a clean catalog is ok', () => {
    expect(validateCatalog([lesson('u01-a', 1), lesson('u01-b', 1, 'checkpoint')])).toEqual({
      ok: true,
    });
  });

  // Updated by M5 item 3 (M5-life-death §3, PO decision 3): a unit may have several lessons
  // (Unit 11 has two), still at most one checkpoint.
  it('reports duplicate ids, two checkpoints in a unit and an orphan checkpoint', () => {
    const dup = validateCatalog([lesson('u01-a', 1), lesson('u01-a', 1)]);
    expect(dup.ok ? [] : dup.errors.map((e) => e.code)).toEqual(['DUPLICATE_LESSON']);
    expect(validateCatalog([lesson('u01-a', 1), lesson('u01-b', 1)])).toEqual({ ok: true });
    const two = validateCatalog([
      lesson('u01-a', 1),
      lesson('u01-b', 1, 'checkpoint'),
      lesson('u01-c', 1, 'checkpoint'),
    ]);
    expect(two.ok ? [] : two.errors.map((e) => e.message)).toEqual([
      'unit 1 must have at most one checkpoint',
    ]);
    const orphan = validateCatalog([lesson('u02-c', 2, 'checkpoint')]);
    expect(orphan.ok ? [] : orphan.errors).toEqual([
      expect.objectContaining({
        code: 'CHECKPOINT_ORDER',
        message: 'checkpoint "u02-c" needs a lesson in unit 2',
      }),
    ]);
  });
});
