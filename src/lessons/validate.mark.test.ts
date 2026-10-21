// `mark`, `count` with `score` and `choice` with `prove` in the validator
// (spec docs/specs/M5-territory-counting.md AC 16–21). X black, O white.
import { allTexts, position, sampleLesson, withExercise } from './__fixtures__/fixtures';
import { EXERCISE_TYPES, type LessonError } from './schema';
import { validateLesson } from './validate';

/** P3: neutral c-column; Black owns the a-column, White the e-column. */
const P3 = `
  . X . O .
  . X . O .
  . X . O .
  . X . O .
  . X . O .
`;

/** D: d3 and e3 neutral; Black 6 + 7 = 13, White 5 + 5 = 10. */
const D = `
  . . . . .
  O O O O O
  X X X . .
  . . X X X
  . . . . .
`;

/** N: c1 (White) and c5 (Black) are dead inside the other side's area. */
const N = `
  . . X . .
  . . . . .
  O O O O O
  X X X X X
  . . O . .
`;

/** A wall pair where each wall's pocket is open (no dead stone). */
const ONLY_BLACK = `
  . . . . .
  . . . . .
  X X X X X
  . . . . .
  . . . . .
`;

function codesOf(exercise: Record<string, unknown>): string[] {
  const result = validateLesson(withExercise(0, exercise), allTexts);
  return result.ok ? [] : result.errors.map((e: LessonError) => e.code);
}

const territory = (extra: Record<string, unknown> = {}) => ({
  id: 'terr',
  type: 'mark',
  mark: 'territory',
  side: 'B',
  ...position(P3),
  promptKey: 'p',
  hintKey: 'h',
  hintPoints: ['a1'],
  explainKey: 'e',
  ...extra,
});

const dead = (extra: Record<string, unknown> = {}) => ({
  id: 'dead',
  type: 'mark',
  mark: 'dead',
  dead: ['c1', 'c5'],
  ...position(N),
  whyKeys: { a2: 'w.black', a3: 'w.white' },
  promptKey: 'p',
  hintKey: 'h',
  hintPoints: ['c1'],
  explainKey: 'e',
  ...extra,
});

const area = (score: Record<string, unknown>, board = D) => ({
  id: 'area',
  type: 'count',
  ...position(board),
  answer: { score },
  promptKey: 'p',
});

const winner = (
  prove: Record<string, unknown>,
  options: Record<string, unknown>[],
  board = P3,
) => ({
  id: 'win',
  type: 'choice',
  ...position(board),
  prove,
  options,
  promptKey: 'p',
});
const BW = (right: 'B' | 'W') => [
  { textKey: 'o.b', outcome: 'B', ...(right === 'B' ? { correct: true } : { whyKey: 'w' }) },
  { textKey: 'o.w', outcome: 'W', ...(right === 'W' ? { correct: true } : { whyKey: 'w' }) },
];

describe('accepted', () => {
  it('EXERCISE_TYPES includes mark', () => {
    expect(EXERCISE_TYPES).toContain('mark');
  });

  it.each([
    ['territory B on P3', territory()],
    ['territory W on D', territory({ side: 'W', ...position(D), hintPoints: ['a5'] })],
    ['dead c1 + c5 on N', dead()],
    ['score area B on D', area({ of: 'area', side: 'B' })],
    ['score area W on N with dead stones', area({ of: 'area', side: 'W', dead: ['c1', 'c5'] }, N)],
    ['winner P3 komi 0.5 = W', winner({ kind: 'winner', komi: 0.5 }, BW('W'))],
    [
      'winner N komi 0.5 dead = W',
      winner({ kind: 'winner', komi: 0.5, dead: ['c1', 'c5'] }, BW('W'), N),
    ],
  ])('%s', (_name, exercise) => {
    expect(codesOf(exercise)).toEqual([]);
  });

  it('owner: c3 on P3 is nobody', () => {
    const options = [
      { textKey: 'b', outcome: 'B', whyKey: 'w' },
      { textKey: 'w', outcome: 'W', whyKey: 'w' },
      { textKey: 'n', outcome: 'none', correct: true },
    ];
    expect(codesOf(winner({ kind: 'owner', at: 'c3' }, options))).toEqual([]);
  });
});

describe('mark rules (AC 16–18)', () => {
  it('MARK_BAD_KIND', () => {
    expect(codesOf(territory({ mark: 'eyes' }))).toContain('MARK_BAD_KIND');
  });

  it('MARK_NO_SIDE', () => {
    const { side: _side, ...noSide } = territory();
    expect(codesOf(noSide)).toContain('MARK_NO_SIDE');
    expect(codesOf(territory({ side: 'X' }))).toContain('MARK_NO_SIDE');
  });

  it('MARK_FIELD: side on dead, dead/whyKeys on territory', () => {
    expect(codesOf(dead({ side: 'B' }))).toContain('MARK_FIELD');
    expect(codesOf(territory({ dead: ['b1'] }))).toContain('MARK_FIELD');
    expect(codesOf(territory({ whyKeys: { b1: 'x' } }))).toContain('MARK_FIELD');
  });

  it('MARK_ONE_COLOR: only black stones', () => {
    expect(codesOf(territory({ ...position(ONLY_BLACK), hintPoints: ['a1'] }))).toContain(
      'MARK_ONE_COLOR',
    );
  });

  it('MARK_EMPTY_ANSWER: a side with no territory; an empty dead list', () => {
    // N without dead stones: neither side owns a single point.
    expect(codesOf(territory({ ...position(N), hintPoints: undefined }))).toContain(
      'MARK_EMPTY_ANSWER',
    );
    expect(codesOf(dead({ dead: [], hintPoints: undefined }))).toContain('MARK_EMPTY_ANSWER');
  });

  it('MARK_DEAD_NOT_STONE', () => {
    expect(codesOf(dead({ dead: ['c1', 'b1'] }))).toContain('MARK_DEAD_NOT_STONE');
  });

  it('MARK_TERRITORY_DEAD: a group without territory of its own needs removing first', () => {
    expect(codesOf(territory({ ...position(N), side: 'W', hintPoints: undefined }))).toContain(
      'MARK_TERRITORY_DEAD',
    );
  });

  it('MARK_DEAD_NOT_PROVEN: an alive wall marked dead', () => {
    expect(codesOf(dead({ dead: ['c1', 'a2'], whyKeys: undefined }))).toContain(
      'MARK_DEAD_NOT_PROVEN',
    );
  });

  it('MARK_WHYKEY: not a stone, or a stone of a dead group', () => {
    expect(codesOf(dead({ whyKeys: { b1: 'x' } }))).toContain('MARK_WHYKEY');
    expect(codesOf(dead({ whyKeys: { c1: 'x' } }))).toContain('MARK_WHYKEY');
  });

  it('BAD_HINT: hintPoints outside the engine answer', () => {
    expect(codesOf(territory({ hintPoints: ['c3'] }))).toContain('BAD_HINT');
  });
});

describe('score rules (AC 19)', () => {
  it('SCORE_BAD', () => {
    expect(codesOf(area({ of: 'eyes', side: 'B' }))).toContain('SCORE_BAD');
    expect(codesOf(area({ of: 'area', side: 'X' }))).toContain('SCORE_BAD');
  });

  it('SCORE_BAD_DEAD', () => {
    expect(codesOf(area({ of: 'area', side: 'B', dead: ['a1'] }))).toContain('SCORE_BAD_DEAD');
  });

  it('SCORE_RANGE: a value of 0', () => {
    // N without removing the dead stones: Black has no territory.
    expect(codesOf(area({ of: 'territory', side: 'B' }, N))).toContain('SCORE_RANGE');
  });
});

describe('choice prove rules (AC 20)', () => {
  it('CHOICE_PROVE_MISMATCH', () => {
    expect(codesOf(winner({ kind: 'winner', komi: 0.5 }, BW('B')))).toContain(
      'CHOICE_PROVE_MISMATCH',
    );
  });

  it('CHOICE_PROVE_OPTIONS: a missing or repeated outcome; outcome without prove', () => {
    const missing = [
      { textKey: 'b', correct: true },
      { textKey: 'w', outcome: 'W', whyKey: 'w' },
    ];
    expect(codesOf(winner({ kind: 'winner', komi: 0.5 }, missing))).toContain(
      'CHOICE_PROVE_OPTIONS',
    );
    const twice = [
      { textKey: 'b', outcome: 'W', whyKey: 'w' },
      { textKey: 'w', outcome: 'W', correct: true },
    ];
    expect(codesOf(winner({ kind: 'winner', komi: 0.5 }, twice))).toContain('CHOICE_PROVE_OPTIONS');
    const { prove: _prove, ...plain } = winner({ kind: 'winner', komi: 0.5 }, BW('W'));
    expect(codesOf(plain)).toContain('CHOICE_PROVE_OPTIONS');
  });

  it('CHOICE_PROVE_DRAW: P3 with komi 0', () => {
    expect(codesOf(winner({ kind: 'winner', komi: 0 }, BW('W')))).toContain('CHOICE_PROVE_DRAW');
  });

  it('CHOICE_PROVE_KOMI', () => {
    expect(codesOf(winner({ kind: 'winner', komi: 0.3 }, BW('W')))).toContain('CHOICE_PROVE_KOMI');
  });

  it('AC 21: texts are never read (same result without any text)', () => {
    const lesson = sampleLesson();
    lesson.exercises[0] = winner({ kind: 'winner', komi: 0.5 }, BW('B'));
    const noText = validateLesson(lesson, { hasText: () => true });
    expect(noText.ok ? [] : noText.errors.map((e) => e.code)).toContain('CHOICE_PROVE_MISMATCH');
  });
});

describe('new highlight and marker kinds', () => {
  it('territoryB / territoryW highlights and a dead marker are accepted in steps', () => {
    const lesson = sampleLesson();
    lesson.explain[0].highlights = [{ kind: 'territoryB', points: ['a1'] }];
    lesson.explain[0].markers = [{ kind: 'dead', at: 'a1' }];
    const result = validateLesson(lesson, allTexts);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });
});
