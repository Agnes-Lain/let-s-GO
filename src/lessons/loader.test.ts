import { allTexts, sampleLesson } from './__fixtures__/fixtures';
import { createLessonLoader, getUnits, listLessons, loadLesson } from './loader';

function unitOne(id = 'u01-board') {
  return { ...sampleLesson(), id, unit: 1, titleKey: 'lesson.u01.title' };
}

describe('loadLesson (AC 25)', () => {
  it('loads the sample in a dev build', () => {
    const result = loadLesson('u00-sample', { includeDev: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.lesson.id).toBe('u00-sample');
  });

  it('defaults to the dev build in tests (__DEV__)', () => {
    expect(loadLesson('u00-sample').ok).toBe(true);
  });

  it('an unknown id is not-found', () => {
    expect(loadLesson('nope')).toEqual({ ok: false, reason: 'not-found' });
  });

  it('an invalid file is reported, never thrown', () => {
    const broken = { ...unitOne(), schema: 2 };
    const loader = createLessonLoader([broken, 'garbage', null], allTexts);
    let result: ReturnType<typeof loader.loadLesson> | undefined;
    expect(() => {
      result = loader.loadLesson('u01-board');
    }).not.toThrow();
    expect(result).toEqual({
      ok: false,
      reason: 'invalid',
      errors: [expect.objectContaining({ code: 'BAD_SCHEMA' })],
    });
    expect(loader.listLessons()).toEqual([]);
  });

  it('the second call returns the cached object', () => {
    const loader = createLessonLoader([unitOne()], allTexts);
    const first = loader.loadLesson('u01-board');
    expect(loader.loadLesson('u01-board')).toBe(first);
  });
});

describe('dev sample visibility (AC 26)', () => {
  it('a production build neither lists nor loads the sample', () => {
    expect(listLessons({ includeDev: false }).map((l) => l.id)).not.toContain('u00-sample');
    expect(loadLesson('u00-sample', { includeDev: false })).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('a dev build lists it first', () => {
    const loader = createLessonLoader([unitOne(), sampleLesson()], allTexts);
    expect(loader.listLessons({ includeDev: true }).map((l) => l.id)).toEqual([
      'u00-sample',
      'u01-board',
    ]);
  });

  it('lessons are sorted by unit, then lesson before checkpoint', () => {
    const checkpoint = { ...unitOne('u01-review'), kind: 'checkpoint' };
    delete (checkpoint as Record<string, unknown>).explain;
    const unitTwo = { ...unitOne('u02-x'), unit: 2 };
    const loader = createLessonLoader([unitTwo, checkpoint, unitOne()], allTexts);
    expect(loader.listLessons({ includeDev: false }).map((l) => l.id)).toEqual([
      'u01-board',
      'u01-review',
      'u02-x',
    ]);
  });
});

describe('getUnits (AC 27)', () => {
  it('M4: units 1–6 carry their lessons (units 5 and 6 have a checkpoint); nothing is planned', () => {
    const units = getUnits({ includeDev: false });
    expect(
      units.map((u) => [u.unit, u.titleKey, u.lesson?.id ?? null, u.checkpoint?.id ?? null]),
    ).toEqual([
      [1, 'unit.1.title', 'u01-board', null],
      [2, 'unit.2.title', 'u02-liberties', null],
      [3, 'unit.3.title', 'u03-connection', null],
      [4, 'unit.4.title', 'u04-capture', null],
      [5, 'unit.5.title', 'u05-atari', 'u05-review'],
      [6, 'unit.6.title', 'u06-capture-go', 'u06-checkpoint'],
    ]);
  });

  it('a dev build adds the sample as unit 0', () => {
    const [first] = getUnits({ includeDev: true });
    expect(first.unit).toBe(0);
    expect(first.lesson?.id).toBe('u00-sample');
    expect(first.titleKey).toBe('lesson.u00-sample.title');
  });

  it('a valid unit-1 lesson makes unit 1 carry it (the map keeps the unit title)', () => {
    const loader = createLessonLoader([unitOne()], allTexts);
    const units = loader.getUnits({ includeDev: false });
    expect(units[0].lesson?.id).toBe('u01-board');
    expect(units[0].titleKey).toBe('unit.1.title');
    // No planned ("coming soon") units since M4 item 2 (PLANNED_UNITS = []).
    expect(units).toHaveLength(1);
  });
});
