import { shouldShowOnboarding } from './onboarding';
import type { LessonProgress } from './progress';

const lesson: LessonProgress = {
  stars: 1,
  plays: 1,
  bestClean: 1,
  bestSolved: 1,
  total: 6,
  lastPlayedAt: 'x',
};
const fresh = { flags: {}, lessons: {}, bots: {}, hydrated: true };

describe('shouldShowOnboarding (AC 24)', () => {
  it('a fresh, hydrated install shows the intro', () => {
    expect(shouldShowOnboarding(fresh)).toBe(true);
  });

  it('never while progress is not read yet', () => {
    expect(shouldShowOnboarding({ ...fresh, hydrated: false })).toBe(false);
  });

  it('not once the intro was left', () => {
    expect(shouldShowOnboarding({ ...fresh, flags: { onboardingSeen: true } })).toBe(false);
  });

  it('not for an existing player: any lesson record or any bot record', () => {
    expect(shouldShowOnboarding({ ...fresh, lessons: { 'u01-board': lesson } })).toBe(false);
    expect(
      shouldShowOnboarding({ ...fresh, bots: { '1': { games: 1, wins: 0, lossStreak: 1 } } }),
    ).toBe(false);
  });

  it('other flags alone do not count as progress', () => {
    expect(shouldShowOnboarding({ ...fresh, flags: { atariHintsOff: true } })).toBe(true);
  });

  it('AC 51: a leftover u00-sample record is not progress', () => {
    expect(shouldShowOnboarding({ ...fresh, lessons: { 'u00-sample': lesson } })).toBe(true);
  });
});
