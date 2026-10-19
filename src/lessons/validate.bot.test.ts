// play-bot exercises in the validator (spec docs/specs/M4-bot-capture-go.md §7, AC 31–36).
import { allTexts, position, sampleLesson } from './__fixtures__/fixtures';
import { EXERCISE_TYPES, type LessonError } from './schema';
import { validateLesson } from './validate';

function errorsOf(input: unknown): LessonError[] {
  const result = validateLesson(input, allTexts);
  return result.ok ? [] : result.errors;
}
const codes = (input: unknown) => errorsOf(input).map((e) => e.code);

/** A valid game: the G2 cross-cut, first to 1. */
function game(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'g',
    type: 'play-bot',
    size: 5,
    setup: { B: ['c3', 'd2'], W: ['d3', 'c2'] },
    win: { kind: 'captureN', n: 1 },
    bot: { level: 1, blunder: 0.5 },
    promptKey: 'p',
    hintKey: 'h',
    explainKey: 'e',
    ...extra,
  };
}

/** A checkpoint made only of games. */
function games(...exercises: Record<string, unknown>[]) {
  return {
    schema: 1,
    id: 'u06-test',
    unit: 6,
    kind: 'checkpoint',
    titleKey: 't',
    exercises: exercises.map((e, i) => ({ ...e, id: `g${i}` })),
  };
}

describe('schema (AC 31)', () => {
  it('knows the play-bot type', () => {
    expect(EXERCISE_TYPES).toContain('play-bot');
  });

  it('a valid game set passes', () => {
    expect(codes(games(game(), game({ player: 'W', first: 'B', maxMoves: 40 })))).toEqual([]);
  });

  it('bot seed is allowed; unknown fields are not', () => {
    expect(codes(games(game({ bot: { level: 1, seed: 3 } }), game()))).toEqual([]);
    expect(codes(games(game({ bot: { level: 1, speed: 3 } }), game()))).toEqual(['UNKNOWN_FIELD']);
    expect(codes(games(game({ toPlay: 'B' }), game()))).toEqual(['UNKNOWN_FIELD']);
  });

  it('win and bot are required', () => {
    const g = game();
    delete g.win;
    delete g.bot;
    expect(codes(games(g, game()))).toEqual(['MISSING_FIELD', 'MISSING_FIELD']);
  });
});

describe('structural rules (AC 32)', () => {
  it.each([
    ['BOT_NO_WIN', { win: { kind: 'score' } }],
    ['BOT_NO_WIN', { win: 3 }],
    ['BOT_BAD_N', { win: { kind: 'captureN', n: 0 } }],
    ['BOT_BAD_N', { win: { kind: 'captureN', n: 1.5 } }],
    ['BOT_BAD_N', { win: { kind: 'captureN', n: 6 } }], // more than the board size (5)
    ['BOT_BAD_N', { win: { kind: 'captureN' } }],
    ['BOT_BAD_LEVEL', { bot: { level: 4 } }],
    ['BOT_BAD_LEVEL', { bot: { blunder: 0.2 } }],
    ['BOT_BAD_BLUNDER', { bot: { level: 1, blunder: 1.5 } }],
    ['BOT_BAD_BLUNDER', { bot: { level: 1, blunder: -0.1 } }],
    ['BOT_BAD_BLUNDER', { bot: { level: 1, blunder: '0.3' } }],
    ['BOT_BAD_PLAYER', { player: 'X' }],
    ['BOT_BAD_PLAYER', { first: 'white' }],
    ['BOT_HINTPOINTS', { hintPoints: ['c4'] }],
    ['BAD_TYPE', { maxMoves: 0 }],
    ['BAD_TYPE', { bot: { level: 1, seed: 'x' } }],
  ])('%s: %j', (code, extra) => {
    expect(codes(games(game(extra), game()))).toEqual([code]);
  });

  it('BOT_NO_MOVE: the side to move first has no legal move', () => {
    // White everywhere except three single-point eyes: every Black move is suicide.
    const full = position(`
      5 O O O O .
      4 O O O O O
      3 O O . O O
      2 O O O O O
      1 . O O O O
    `);
    expect(codes(games(game({ ...full, win: { kind: 'captureN', n: 1 } }), game()))).toEqual([
      'BOT_NO_MOVE',
    ]);
  });

  it('BOT_START_LOST: n = 1, the learner moves first and every move lets the bot capture', () => {
    // Black a1 (liberty b1) and e1 (liberty d1) are both in atari: Black saves one, White takes the other.
    const lost = position(`
      5 . . . . .
      4 . . . . .
      3 . . . . .
      2 O . . . O
      1 X . . . X
    `);
    expect(codes(games(game(lost), game()))).toEqual(['BOT_START_LOST']);
  });

  it('BOT_START_LOST is not checked when the bot moves first or n > 1', () => {
    const lost = position(`
      5 . . . . .
      4 . . . . .
      3 . . . . .
      2 O . . . O
      1 X . . . X
    `);
    expect(codes(games(game({ ...lost, win: { kind: 'captureN', n: 2 } }), game()))).not.toContain(
      'BOT_START_LOST',
    );
  });

  it('a capture that wins at once is a safe first move (G1)', () => {
    const g1 = { setup: { B: ['b3', 'c2', 'd3'], W: ['c3'] }, bot: { level: 1, blunder: 0 } };
    expect(codes(games(game(g1), game()))).toEqual([]);
  });
});

describe('smoke playouts (AC 32, 35)', () => {
  it('BOT_UNWINNABLE: the reference learner wins none of 10 playouts', () => {
    // Two plies, nobody can capture: always a draw.
    expect(codes(games(game({ maxMoves: 2 }), game()))).toEqual(['BOT_UNWINNABLE']);
  });

  it('a winnable game reports nothing', () => {
    expect(codes(games(game({ bot: { level: 1, blunder: 0 } }), game()))).toEqual([]);
  });
});

describe('exercise count (AC 33)', () => {
  it('a set made only of games has 2–6 exercises', () => {
    expect(codes(games(game()))).toEqual(['BAD_EXERCISE_COUNT']);
    expect(errorsOf(games(game()))[0].message).toBe(
      'a set made only of play-bot games must have 2 to 6 exercises, found 1',
    );
    expect(codes(games(game(), game()))).toEqual([]);
    expect(codes(games(...Array.from({ length: 6 }, () => game())))).toEqual([]);
    expect(codes(games(...Array.from({ length: 7 }, () => game())))).toEqual([
      'BAD_EXERCISE_COUNT',
    ]);
  });

  it('a set mixing games and other exercises needs 5–10', () => {
    const lesson = sampleLesson();
    lesson.exercises = [...lesson.exercises.slice(0, 3), { ...game(), id: 'g1' }];
    expect(codes(lesson)).toEqual(['BAD_EXERCISE_COUNT']);
    lesson.exercises.push({ ...game(), id: 'g2' });
    expect(codes(lesson)).toEqual([]);
  });
});

describe('speed (AC 36)', () => {
  it('validates a 9×9 game (10 playouts) in under 300 ms', () => {
    const nine = games(
      game({
        size: 9,
        setup: { B: ['e5', 'f4'], W: ['f5', 'e4'] },
        win: { kind: 'captureN', n: 9 },
      }),
      game(),
    );
    validateLesson(nine, allTexts); // warm-up
    const t0 = process.hrtime.bigint();
    expect(codes(nine)).toEqual([]);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    expect(ms).toBeLessThan(300 + 50); // + the second, small game
  });
});
