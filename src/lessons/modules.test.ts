// Home modules (docs/specs/M6-settings-onboarding-a11y.md §4.8, AC 55, 57, 59, 60).
import { getUnits } from './loader';
import { mapRows, type MapRow } from './map';
import { MODULES, defaultExpandedModules, moduleOf, moduleSummaries } from './modules';
import type { StarsByLesson } from './schema';

const stars = (entries: Record<string, number>): StarsByLesson =>
  Object.fromEntries(
    Object.entries(entries).map(([id, n]) => [id, { stars: n }]),
  ) as unknown as StarsByLesson;

const units = getUnits();
const rowsFor = (progress: Record<string, number>) => mapRows(units, stars(progress));
/** Every lesson and checkpoint id of the real catalog, in map order. */
const allIds = mapRows(units, {}).map((r) => r.lesson?.id as string);

describe('moduleOf (AC 55)', () => {
  it.each([
    [1, 1],
    [5, 1],
    [6, 2],
    [9, 2],
    [10, 3],
    [14, 3],
  ])('unit %i → module %i', (unit, module) => {
    expect(moduleOf(unit)).toBe(module);
  });

  it('units outside the table have no module', () => {
    expect(moduleOf(0)).toBeNull();
    expect(moduleOf(15)).toBeNull();
  });

  it('every unit of the catalog is in exactly one module (a new unit must be added on purpose)', () => {
    for (const { unit } of units) {
      const holders = MODULES.filter((m) => unit >= m.from && unit <= m.to);
      expect({ unit, holders: holders.length }).toEqual({ unit, holders: 1 });
    }
  });

  it('the table: 1–5, 6–9, 10–14 with their title keys', () => {
    expect(MODULES.map((m) => [m.id, m.from, m.to, m.titleKey])).toEqual([
      [1, 1, 5, 'home.module.1.title'],
      [2, 6, 9, 'home.module.2.title'],
      [3, 10, 14, 'home.module.3.title'],
    ]);
  });
});

describe('moduleSummaries (AC 56, 59, 60)', () => {
  it('splits the map rows by unit, keeping their order (checkpoints and later lessons included)', () => {
    const rows = rowsFor({});
    const summaries = moduleSummaries(rows);
    expect(summaries.flatMap((s) => s.rows)).toEqual(rows);
    expect(summaries[0].rows.map((r) => r.key)).toEqual([
      'unit-1',
      'unit-2',
      'unit-3',
      'unit-4',
      'unit-5',
      'checkpoint-5',
    ]);
    expect(summaries[2].rows.map((r) => r.key)).toContain('lesson-u11-vital');
  });

  it('a new learner: 0 of N done; module 1 open, 2 and 3 locked', () => {
    const summaries = moduleSummaries(rowsFor({}));
    expect(summaries.map((s) => [s.module.id, s.done, s.total, s.locked])).toEqual([
      [1, 0, 6, false],
      [2, 0, 6, true],
      [3, 0, 8, true],
    ]);
  });

  it('done counts rows with ≥ 1★; "soon" rows do not count', () => {
    const soon: MapRow = {
      key: 'unit-14b',
      kind: 'unit',
      unit: 14,
      lesson: null,
      titleKey: 'unit.14.title',
      state: 'soon',
      stars: 0,
    };
    const rows = [...rowsFor({ 'u01-board': 3, 'u02-liberties': 1 }), soon];
    const [first, , third] = moduleSummaries(rows);
    expect([first.done, first.total]).toEqual([2, 6]);
    expect(third.total).toBe(8);
  });

  it('module 2 unlocks once its first row is open (Unit 5 lesson has a star)', () => {
    const summaries = moduleSummaries(
      rowsFor({
        'u01-board': 1,
        'u02-liberties': 1,
        'u03-connection': 1,
        'u04-capture': 1,
        'u05-atari': 1,
      }),
    );
    expect(summaries.map((s) => s.locked)).toEqual([false, false, true]);
  });
});

describe('defaultExpandedModules (AC 57)', () => {
  it('a new learner sees module 1 open', () => {
    expect(defaultExpandedModules(rowsFor({}))).toEqual([1]);
  });

  it('the module of the first available row is open', () => {
    const m1 = Object.fromEntries(allIds.slice(0, 6).map((id) => [id, 2]));
    expect(defaultExpandedModules(rowsFor(m1))).toEqual([2]);
    const upTo11 = Object.fromEntries(allIds.slice(0, 13).map((id) => [id, 1]));
    expect(defaultExpandedModules(rowsFor(upTo11))).toEqual([3]);
  });

  it('everything done: all collapsed', () => {
    const all = Object.fromEntries(allIds.map((id) => [id, 1]));
    expect(defaultExpandedModules(rowsFor(all))).toEqual([]);
  });
});
