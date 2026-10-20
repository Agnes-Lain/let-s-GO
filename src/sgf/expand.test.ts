// `.src.json` expansion (spec docs/specs/M5-sgf-import.md §5, AC 19).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { allTexts } from '@/lessons/__fixtures__/fixtures';
import { validateLesson } from '@/lessons/validate';

import { expandLessonSource } from './expand';
import type { LessonSource, SgfIssue } from './types';

const FIXTURES = join(__dirname, '..', '..', '__tests__', 'fixtures', 'sgf');
const FILES: Record<string, string> = {
  'f1.sgf': readFileSync(join(FIXTURES, 'f1-capture-in-one.sgf'), 'utf8'),
  'f2.sgf': readFileSync(join(FIXTURES, 'f2-ladder.sgf'), 'utf8'),
  'bad.sgf': '(;GM[1]FF[4]SZ[5]\nAB[zz];B[aa])',
  'warn.sgf': '(;SZ[5]TR[aa]AB[bc][dc][cb]AW[cc](;B[cd])(;B[ae]))',
};

function readSgf(path: string): string {
  const text = FILES[path];
  if (text === undefined) throw new Error(`ENOENT: no such file "${path}"`);
  return text;
}

function sequence(id: string, sgf: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: 'sequence',
    sgf,
    goal: { kind: 'capture', target: 'c3' },
    promptKey: `lesson.u10-example.${id}.prompt`,
    hintKey: `lesson.u10-example.${id}.hint`,
    ...extra,
  };
}

/** A checkpoint with 5 exercises: 4 imported problems and one hand-written tap-point. */
function source(first: Record<string, unknown> = sequence('e1', 'f1.sgf')): LessonSource {
  return {
    schema: 1,
    id: 'u10-example',
    unit: 10,
    kind: 'checkpoint',
    titleKey: 'lesson.u10-example.title',
    exercises: [
      first,
      sequence('e2', 'f2.sgf'),
      sequence('e3', 'f1.sgf'),
      sequence('e4', 'f2.sgf', { goal: { kind: 'line' } }),
      {
        id: 'e5',
        type: 'tap-point',
        size: 5,
        setup: { B: ['c3'] },
        mode: 'all',
        answer: { libertiesOf: 'c3' },
        promptKey: 'lesson.u10-example.e5.prompt',
      },
    ],
  };
}

function expanded(src: LessonSource) {
  const result = expandLessonSource(src, readSgf);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.lesson as { exercises: Record<string, unknown>[] };
}

function errors(src: LessonSource): SgfIssue[] {
  const result = expandLessonSource(src, readSgf);
  if (result.ok) throw new Error('expected an error');
  return result.errors;
}

describe('expandLessonSource (AC 19)', () => {
  it('fills in the converted fields and keeps keys, goal and id from the source', () => {
    const lesson = expanded(source());
    expect(lesson.exercises[0]).toEqual({
      id: 'e1',
      type: 'sequence',
      size: 5,
      setup: { B: ['b3', 'c4', 'd3'], W: ['c3'] },
      toPlay: 'B',
      goal: { kind: 'capture', target: 'c3' },
      line: [{ color: 'B', at: 'c2' }],
      wrong: [{ line: [{ color: 'B', at: 'a1' }] }],
      promptKey: 'lesson.u10-example.e1.prompt',
      hintKey: 'lesson.u10-example.e1.hint',
    });
    expect(lesson.exercises.some((e) => 'sgf' in e || 'whyKeys' in e)).toBe(false);
  });

  it('the expanded lesson passes the validator', () => {
    const lesson = expanded(source());
    const result = validateLesson(lesson, allTexts);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('other exercises and lesson fields pass through unchanged', () => {
    const src = source();
    const lesson = expanded(src) as unknown as Record<string, unknown>;
    expect(lesson.titleKey).toBe(src.titleKey);
    expect((lesson.exercises as unknown[])[4]).toEqual((src.exercises as unknown[])[4]);
  });

  it('whyKeys attach a whyKey to the wrong branch with that first move', () => {
    const lesson = expanded(source(sequence('e1', 'f1.sgf', { whyKeys: { a1: 'lesson.why' } })));
    expect(lesson.exercises[0].wrong).toEqual([
      { line: [{ color: 'B', at: 'a1' }], whyKey: 'lesson.why' },
    ]);
  });

  it('a whyKeys point that is no wrong first move is an error', () => {
    const [error] = errors(source(sequence('e1', 'f1.sgf', { whyKeys: { b2: 'lesson.why' } })));
    expect(error.code).toBe('SRC_UNKNOWN_WHY');
    expect(error.message).toContain('exercises[0]');
  });

  it('a missing file is an error with the path and 1:1', () => {
    expect(errors(source(sequence('e1', 'nope.sgf')))).toEqual([
      expect.objectContaining({ code: 'SGF_FILE_NOT_FOUND', file: 'nope.sgf', line: 1, col: 1 }),
    ]);
  });

  it('an SGF error carries the file path and line:col', () => {
    expect(errors(source(sequence('e1', 'bad.sgf')))).toEqual([
      expect.objectContaining({ code: 'SGF_BAD_POINT', file: 'bad.sgf', line: 2, col: 3 }),
    ]);
  });

  it('a parse error carries the file path too', () => {
    FILES['broken.sgf'] = '(;SZ[5]';
    expect(errors(source(sequence('e1', 'broken.sgf')))).toEqual([
      expect.objectContaining({ code: 'SGF_UNBALANCED_PARENS', file: 'broken.sgf' }),
    ]);
  });

  it('warnings are returned with the file path', () => {
    const result = expandLessonSource(source(sequence('e1', 'warn.sgf')), readSgf);
    expect(result.ok && result.warnings).toEqual([
      expect.objectContaining({ code: 'SGF_UNSUPPORTED_PROPERTY', file: 'warn.sgf' }),
    ]);
  });

  it.each([['size'], ['setup'], ['toPlay'], ['line'], ['wrong']])(
    'an exercise with sgf and "%s" is an error',
    (field) => {
      const [error] = errors(source(sequence('e1', 'f1.sgf', { [field]: 5 })));
      expect(error.code).toBe('SRC_BAD_EXERCISE');
    },
  );

  it('sgf on another exercise type is an error', () => {
    const [error] = errors(source({ id: 'x', type: 'play-move', sgf: 'f1.sgf' }));
    expect(error.code).toBe('SRC_BAD_EXERCISE');
  });

  it('a hand-written sequence exercise (no sgf) passes through', () => {
    const exercise = {
      id: 'e1',
      type: 'sequence',
      size: 5,
      setup: { W: ['c3'] },
      toPlay: 'B',
      goal: { kind: 'line' },
      line: [{ color: 'B', at: 'c2' }],
      promptKey: 'p',
    };
    expect(expanded(source(exercise)).exercises[0]).toEqual(exercise);
  });

  it('M5-sequence-v2 AC 13: a judge field is copied unchanged', () => {
    const judge = { kind: 'search', opponent: 'run', maxMoves: 4 };
    const lesson = expanded(source(sequence('e1', 'f2.sgf', { judge })));
    expect(lesson.exercises[0].judge).toEqual(judge);
    expect(lesson.exercises[1]).not.toHaveProperty('judge');
  });
});
