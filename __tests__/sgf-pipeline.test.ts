/**
 * `npm run import:sgf` pipeline (spec docs/specs/M5-sgf-import.md §5, AC 20): writes lesson JSON
 * for every content-src/*.src.json, reports file:line:col, writes nothing for a lesson with an
 * error, is byte-identical on re-run; plus the drift test for the committed generated JSON.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { validateLesson } from '@/lessons';

import {
  REPO_ROOT,
  SRC_SUFFIX,
  buildLesson,
  importLessons,
  lessonSources,
} from '../scripts/import-sgf';

const FIXTURE_SRC = join(__dirname, 'fixtures', 'sgf', 'content-src');

describe('import pipeline on the fixture sources (AC 20)', () => {
  let outDir: string;
  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'lets-go-sgf-'));
  });
  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  function run() {
    return importLessons({ srcDir: FIXTURE_SRC, outDir, root: REPO_ROOT });
  }

  it('writes the good lesson and only that one', () => {
    const report = run();
    expect(readdirSync(outDir)).toEqual(['u10-example.json']);
    expect(report.written).toEqual([expect.stringMatching(/u10-example\.json$/)]);
  });

  it('the written lesson is valid, generated from its source, with no sgf fields', () => {
    run();
    const text = readFileSync(join(outDir, 'u10-example.json'), 'utf8');
    const lesson = JSON.parse(text);
    expect(lesson.generatedFrom).toBe('__tests__/fixtures/sgf/content-src/u10-example.src.json');
    expect(text).not.toMatch(/"sgf"|"whyKeys"/);
    expect(lesson.exercises[0].wrong).toEqual([
      { line: [{ color: 'B', at: 'a1' }], whyKey: 'lesson.u10-example.e1.why-a1' },
    ]);
    expect(lesson.exercises[1].line).toHaveLength(7);
    const result = validateLesson(lesson, { hasText: () => true });
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('reports the broken lesson as file:line:col error lines', () => {
    expect(run().errors).toEqual([
      '__tests__/fixtures/sgf/content-src/u11-broken/e1.sgf:1:40 error SGF_BAD_POINT: AB[zz] is outside a 5x5 board',
      '__tests__/fixtures/sgf/content-src/u11-broken/e1.sgf:1:40 error SGF_BAD_POINT: AB[zz] is outside a 5x5 board',
      '__tests__/fixtures/sgf/content-src/u11-broken/e1.sgf:1:40 error SGF_BAD_POINT: AB[zz] is outside a 5x5 board',
      '__tests__/fixtures/sgf/content-src/u11-broken/e1.sgf:1:40 error SGF_BAD_POINT: AB[zz] is outside a 5x5 board',
      '__tests__/fixtures/sgf/content-src/u11-broken/e1.sgf:1:40 error SGF_BAD_POINT: AB[zz] is outside a 5x5 board',
    ]);
  });

  it('is byte-identical when run again', () => {
    run();
    const first = readFileSync(join(outDir, 'u10-example.json'), 'utf8');
    run();
    expect(readFileSync(join(outDir, 'u10-example.json'), 'utf8')).toBe(first);
  });

  it('output is Prettier-formatted (format:check passes on it)', () => {
    run();
    const text = readFileSync(join(outDir, 'u10-example.json'), 'utf8');
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "exercises": [\n');
  });

  it('validator errors become error lines on the source file', () => {
    const result = buildLesson(join(FIXTURE_SRC, 'u10-example.src.json'), {
      root: REPO_ROOT,
      hasText: (key) => key !== 'lesson.u10-example.e2.explain',
    });
    expect(!result.ok && result.errors).toEqual([
      expect.stringMatching(
        /^__tests__\/fixtures\/sgf\/content-src\/u10-example\.src\.json:1:1 error MISSING_TEXT: exercises\[1\]\.explainKey: /,
      ),
    ]);
  });

  it('a missing content-src folder imports nothing', () => {
    expect(importLessons({ srcDir: join(outDir, 'none'), outDir })).toEqual({
      written: [],
      errors: [],
      warnings: [],
    });
  });
});

describe('drift: committed generated JSON equals a fresh conversion (AC 20)', () => {
  const sources = lessonSources(join(REPO_ROOT, 'content-src'));

  if (sources.length === 0) {
    it.skip('no content-src/*.src.json yet', () => {});
    return;
  }

  it.each(sources.map((file) => basename(file, SRC_SUFFIX)))('%s is up to date', (id) => {
    const result = buildLesson(join(REPO_ROOT, 'content-src', `${id}${SRC_SUFFIX}`), {});
    expect(result.ok ? [] : result.errors).toEqual([]);
    if (!result.ok) return;
    const committed = JSON.parse(
      readFileSync(join(REPO_ROOT, 'src', 'lessons', 'content', `${id}.json`), 'utf8'),
    );
    expect(committed).toEqual(result.lesson);
  });
});
