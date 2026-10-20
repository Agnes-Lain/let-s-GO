// M5 item 3 QA: units with several lessons (UnitEntry.laterLessons), e.g. Unit 11.
import { sampleLesson } from './__fixtures__/fixtures';
import type { Lesson, StarsByLesson, UnitEntry } from './schema';
import {
  isCheckpointUnlocked,
  isLessonUnlocked,
  isUnlocked,
  mapNodes,
  nextNode,
  unitLessons,
} from './unlock';

const base = sampleLesson() as Lesson;
const mk = (unit: number, id: string, kind: Lesson['kind'] = 'lesson'): Lesson => ({
  ...base,
  id,
  unit,
  kind,
});
const units: UnitEntry[] = [
  { unit: 10, titleKey: 't10', lesson: mk(10, 'a'), checkpoint: null },
  {
    unit: 11,
    titleKey: 't11',
    lesson: mk(11, 'b1'),
    laterLessons: [mk(11, 'b2')],
    checkpoint: mk(11, 'bc', 'checkpoint'),
  },
  { unit: 12, titleKey: 't12', lesson: mk(12, 'c'), checkpoint: null },
];
const st = (m: Record<string, number>): StarsByLesson =>
  Object.fromEntries(Object.entries(m).map(([id, s]) => [id, { stars: s }]));

describe('laterLessons unlock logic', () => {
  it('lists lessons in order and maps them before the checkpoint', () => {
    expect(unitLessons(units[1]).map((l) => l.id)).toEqual(['b1', 'b2']);
    expect(mapNodes(units).map((n) => n.lesson.id)).toEqual(['a', 'b1', 'b2', 'bc', 'c']);
  });
  it('the second lesson needs 1 star on the first', () => {
    const b2 = units[1].laterLessons![0];
    expect(isLessonUnlocked(units, st({ a: 1 }), b2)).toBe(false);
    expect(isLessonUnlocked(units, st({ a: 1, b1: 0 }), b2)).toBe(false);
    expect(isLessonUnlocked(units, st({ a: 1, b1: 1 }), b2)).toBe(true);
  });
  it('the second lesson stays locked if its unit is locked', () => {
    expect(isLessonUnlocked(units, st({ b1: 3 }), units[1].laterLessons![0])).toBe(false);
  });
  it('checkpoint and next unit open on the LAST lesson, not the first', () => {
    expect(isCheckpointUnlocked(units, st({ a: 1, b1: 3 }), 11)).toBe(false);
    expect(isUnlocked(units, st({ a: 1, b1: 3 }), 12)).toBe(false);
    expect(isCheckpointUnlocked(units, st({ a: 1, b1: 1, b2: 1 }), 11)).toBe(true);
    expect(isUnlocked(units, st({ a: 1, b1: 1, b2: 1 }), 12)).toBe(true);
  });
  it('nextNode walks into the second lesson', () => {
    expect(nextNode(units, st({ a: 1, b1: 1 }))?.lesson.id).toBe('b2');
  });
});
