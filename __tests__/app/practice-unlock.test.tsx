// M3 AC 92: finishing unit 1 (0★ → 1★) unlocks unit 2 and offers *Next lesson*.
import { act, screen } from 'expo-router/testing-library';

import { goTo, open, press, reduceMotion, settle } from '@/exercises/__fixtures__/practiceDriver';
import { setLanguageChoice } from '@/i18n';
import { progressStore } from '@/store';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));
jest.mock('@/lessons/registry', () => {
  const actual = jest.requireActual('@/lessons/registry');
  const [sample] = actual.LESSON_FILES;
  return {
    ...actual,
    LESSON_FILES: [
      sample,
      { ...sample, id: 'u01-test', unit: 1 },
      { ...sample, id: 'u02-test', unit: 2 },
    ],
  };
});

beforeEach(async () => {
  jest.useFakeTimers();
  reduceMotion(true);
  progressStore.getState().reset();
  await act(() => setLanguageChoice('en'));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('unit unlocked (AC 92)', () => {
  it('shows "Unit 2 unlocked" and Next lesson → /lesson/u02-test', async () => {
    const router = await open('/practice/u01-test');
    await goTo(6);
    expect(screen.getByText('Unit 2 unlocked')).toBeOnTheScreen();
    await press('result-next');
    await settle();
    expect(router.getPathname()).toBe('/lesson/u02-test');
  });

  it('a replay that does not unlock anything shows no badge', async () => {
    act(() => {
      progressStore.getState().record('u01-test', ['clean']);
    });
    await open('/practice/u01-test');
    await goTo(6);
    expect(screen.queryByTestId('result-unlocked')).toBeNull();
    expect(screen.getByTestId('result-next')).toBeTruthy();
  });
});
