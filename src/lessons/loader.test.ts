import { allTexts, sampleLesson } from './__fixtures__/fixtures';
import { createLessonLoader, getUnits, listLessons, loadLesson } from './loader';

function unitOne(id = 'u01-board') {
  return { ...sampleLesson(), id, unit: 1, titleKey: 'lesson.u01.title' };
}

describe('loadLesson (AC 25)', () => {
  it('loads a shipped lesson', () => {
    const result = loadLesson('u01-board');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.lesson.id).toBe('u01-board');
  });

  it('the removed developer sample is not-found, in __DEV__ too (M6-settings AC 50)', () => {
    expect(loadLesson('u00-sample')).toEqual({ ok: false, reason: 'not-found' });
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

describe('no developer sample (AC 26, M6-settings AC 50)', () => {
  it('the app lists no unit-0 lesson', () => {
    expect(listLessons().map((l) => l.id)).not.toContain('u00-sample');
    expect(listLessons().some((l) => l.unit === 0)).toBe(false);
    expect(getUnits()[0].unit).toBe(1);
  });

  it('a loader fed a unit-0 file (test fixture) lists it first, like any unit', () => {
    const loader = createLessonLoader([unitOne(), sampleLesson()], allTexts);
    expect(loader.listLessons().map((l) => l.id)).toEqual(['u00-sample', 'u01-board']);
  });

  it('lessons are sorted by unit, then lesson before checkpoint', () => {
    const checkpoint = { ...unitOne('u01-review'), kind: 'checkpoint' };
    delete (checkpoint as Record<string, unknown>).explain;
    const unitTwo = { ...unitOne('u02-x'), unit: 2 };
    const loader = createLessonLoader([unitTwo, checkpoint, unitOne()], allTexts);
    expect(loader.listLessons().map((l) => l.id)).toEqual(['u01-board', 'u01-review', 'u02-x']);
  });
});

describe('getUnits (AC 27)', () => {
  // Updated by M5 item 3: Units 10–11 ship (Unit 11 has two lessons), Unit 12 is planned.
  // Updated by M5 item 4: Units 12–14 ship (Unit 14 has a checkpoint); nothing is planned.
  it('M5: units 1–14 carry their lessons (units 5, 6, 9, 11 and 14 have a checkpoint)', () => {
    const units = getUnits();
    expect(
      units.map((u) => [u.unit, u.titleKey, u.lesson?.id ?? null, u.checkpoint?.id ?? null]),
    ).toEqual([
      [1, 'unit.1.title', 'u01-board', null],
      [2, 'unit.2.title', 'u02-liberties', null],
      [3, 'unit.3.title', 'u03-connection', null],
      [4, 'unit.4.title', 'u04-capture', null],
      [5, 'unit.5.title', 'u05-atari', 'u05-review'],
      [6, 'unit.6.title', 'u06-capture-go', 'u06-checkpoint'],
      [7, 'unit.7.title', 'u07-forbidden', null],
      [8, 'unit.8.title', 'u08-ko', null],
      [9, 'unit.9.title', 'u09-ladder', 'u09-review'],
      [10, 'unit.10.title', 'u10-eyes', null],
      [11, 'unit.11.title', 'u11-two-eyes', 'u11-review'],
      [12, 'unit.12.title', 'u12-territory', null],
      [13, 'unit.13.title', 'u13-counting', null],
      [14, 'unit.14.title', 'u14-end', 'u14-review'],
    ]);
    expect(units.find((u) => u.unit === 11)?.laterLessons?.map((l) => l.id)).toEqual(['u11-vital']);
  });

  it('the first unit is Unit 1 "Board & stones" (M6-settings AC 50)', () => {
    const [first] = getUnits();
    expect(first.unit).toBe(1);
    expect(first.titleKey).toBe('unit.1.title');
  });

  it('a valid unit-1 lesson makes unit 1 carry it (the map keeps the unit title)', () => {
    const loader = createLessonLoader([unitOne()], allTexts);
    const units = loader.getUnits();
    expect(units[0].lesson?.id).toBe('u01-board');
    expect(units[0].titleKey).toBe('unit.1.title');
    // No planned ("coming soon") unit follows since M5 item 4 (PLANNED_UNITS = []).
    expect(units.map((u) => [u.unit, u.lesson])).toEqual([[1, units[0].lesson]]);
  });
});
