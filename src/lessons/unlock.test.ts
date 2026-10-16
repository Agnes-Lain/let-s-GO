import { sampleLesson } from './__fixtures__/fixtures';
import type { Lesson, StarsByLesson, UnitEntry } from './schema';
import {
  isCheckpointUnlocked,
  isLessonUnlocked,
  isUnlocked,
  newlyUnlockedUnit,
  nextNode,
} from './unlock';

const base = sampleLesson() as Lesson;
const lesson = (unit: number, kind: Lesson['kind'] = 'lesson'): Lesson => ({
  ...base,
  id: `u0${unit}-${kind}`,
  unit,
  kind,
});
const entry = (unit: number, withLesson = true, withCheckpoint = false): UnitEntry => ({
  unit,
  titleKey: `unit.${unit}.title`,
  lesson: withLesson ? lesson(unit) : null,
  checkpoint: withCheckpoint ? lesson(unit, 'checkpoint') : null,
});
const stars = (map: Record<string, number>): StarsByLesson =>
  Object.fromEntries(Object.entries(map).map(([id, s]) => [id, { stars: s }]));

describe('isUnlocked (AC 39–42)', () => {
  const units = [entry(1), entry(2), entry(3), entry(4, false)];

  it('AC 39: fresh progress opens only unit 1', () => {
    expect([1, 2, 3].map((u) => isUnlocked(units, {}, u))).toEqual([true, false, false]);
  });

  it('AC 39: 1★ on unit 1 opens unit 2 only', () => {
    const p = stars({ 'u01-lesson': 1 });
    expect([1, 2, 3].map((u) => isUnlocked(units, p, u))).toEqual([true, true, false]);
  });

  it('AC 39: 0★ (played) keeps unit 2 locked; 3★ on u1 with 0 on u2 keeps 3 locked', () => {
    expect(isUnlocked(units, stars({ 'u01-lesson': 0 }), 2)).toBe(false);
    expect(isUnlocked(units, stars({ 'u01-lesson': 3, 'u02-lesson': 0 }), 3)).toBe(false);
  });

  it('AC 40: a planned unit never unlocks', () => {
    const p = stars({ 'u01-lesson': 3, 'u02-lesson': 3, 'u03-lesson': 3 });
    expect(isUnlocked(units, p, 4)).toBe(false);
  });

  it('AC 41: the checkpoint opens with 1★ on its lesson and gates nothing', () => {
    const withCheckpoint = [entry(1), entry(2, true, true), entry(3)];
    const p = stars({ 'u01-lesson': 1, 'u02-lesson': 1, 'u02-checkpoint': 0 });
    expect(isCheckpointUnlocked(withCheckpoint, p, 2)).toBe(true);
    expect(isUnlocked(withCheckpoint, p, 3)).toBe(true);
    expect(isCheckpointUnlocked(withCheckpoint, stars({ 'u01-lesson': 1 }), 2)).toBe(false);
    expect(isLessonUnlocked(withCheckpoint, p, lesson(2, 'checkpoint'))).toBe(true);
  });

  it('AC 42: the sample is always open and never locks unit 1', () => {
    const withSample = [{ ...entry(0), lesson: base }, entry(1), entry(2)];
    expect(isUnlocked(withSample, {}, 0)).toBe(true);
    expect(isUnlocked(withSample, stars({ 'u00-sample': 0 }), 1)).toBe(true);
    expect(isUnlocked(withSample, stars({ 'u00-sample': 3 }), 2)).toBe(false);
  });
});

describe('nextNode (AC 43)', () => {
  const units = [entry(1, true, true), entry(2), entry(3, false)];

  it('is the first unlocked node with 0★ in map order', () => {
    expect(nextNode(units, {})?.lesson.id).toBe('u01-lesson');
    const p = stars({ 'u01-lesson': 2 });
    expect(nextNode(units, p)?.lesson.id).toBe('u01-checkpoint');
    expect(nextNode(units, stars({ 'u01-lesson': 2, 'u01-checkpoint': 1 }))?.lesson.id).toBe(
      'u02-lesson',
    );
  });

  it('is null when everything open has a star', () => {
    expect(
      nextNode(units, stars({ 'u01-lesson': 2, 'u01-checkpoint': 1, 'u02-lesson': 1 })),
    ).toBeNull();
  });
});

describe('newlyUnlockedUnit', () => {
  const units = [entry(1), entry(2)];
  it('names a unit that opened between two progress states', () => {
    expect(newlyUnlockedUnit(units, {}, stars({ 'u01-lesson': 1 }))).toBe(2);
    expect(newlyUnlockedUnit(units, stars({ 'u01-lesson': 1 }), stars({ 'u01-lesson': 2 }))).toBe(
      null,
    );
    expect(newlyUnlockedUnit(units, {}, stars({ 'u01-lesson': 0 }))).toBe(null);
  });
});
