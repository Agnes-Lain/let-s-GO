import { sampleLesson } from './__fixtures__/fixtures';
import { mapRows } from './map';
import type { Lesson, UnitEntry } from './schema';

const base = sampleLesson() as Lesson;
const lesson = (unit: number, kind: Lesson['kind'] = 'lesson'): Lesson => ({
  ...base,
  id: `u0${unit}-${kind}`,
  unit,
  kind,
  titleKey: `t.${unit}.${kind}`,
});
const unit = (n: number, content = true, checkpoint = false): UnitEntry => ({
  unit: n,
  titleKey: `unit.${n}.title`,
  lesson: content ? lesson(n) : null,
  checkpoint: checkpoint ? lesson(n, 'checkpoint') : null,
});

describe('mapRows (AC 97–103)', () => {
  it('done / available / locked / soon', () => {
    const units = [unit(1), unit(2), unit(3), unit(4, false)];
    const rows = mapRows(units, { 'u01-lesson': { stars: 3 }, 'u02-lesson': { stars: 0 } });
    expect(rows.map((r) => [r.unit, r.state, r.stars, r.titleKey])).toEqual([
      [1, 'done', 3, 'unit.1.title'],
      [2, 'available', 0, 'unit.2.title'],
      [3, 'locked', 0, 'unit.3.title'],
      [4, 'soon', 0, 'unit.4.title'],
    ]);
  });

  it('the sample row uses the lesson title and is available', () => {
    const rows = mapRows([{ ...unit(0), lesson: base }, unit(1, false)], {});
    expect(rows[0]).toMatchObject({ titleKey: 'lesson.u00-sample.title', state: 'available' });
    expect(rows[1].state).toBe('soon');
  });

  it('a checkpoint row follows its unit and is locked until the lesson has 1★', () => {
    const units = [unit(1), unit(2, true, true)];
    const locked = mapRows(units, { 'u01-lesson': { stars: 1 } });
    expect(locked.map((r) => [r.kind, r.unit, r.state])).toEqual([
      ['unit', 1, 'done'],
      ['unit', 2, 'available'],
      ['checkpoint', 2, 'locked'],
    ]);
    const open = mapRows(units, { 'u01-lesson': { stars: 1 }, 'u02-lesson': { stars: 1 } });
    expect(open[2]).toMatchObject({ state: 'available', titleKey: 't.2.checkpoint' });
  });
});
