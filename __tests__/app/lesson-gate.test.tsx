// M3 ACs 52 (coordinates) and 56 (locked lesson), with test lessons for units 1 and 2.
import { act, renderRouter, screen } from 'expo-router/testing-library';

import { setLanguageChoice } from '@/i18n';
import { progressStore } from '@/store';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));
jest.mock('@/lessons/registry', () => {
  const { registryWithSample, SAMPLE_LESSON: sample } = jest.requireActual(
    '@/lessons/__fixtures__/sampleRegistry',
  );
  const actual = registryWithSample();
  return {
    ...actual,
    // No unit-0 file: Unit 1 comes first and is open (the developer sample is gone, M6-settings).
    LESSON_FILES: [
      { ...sample, id: 'u01-test', unit: 1 },
      { ...sample, id: 'u02-test', unit: 2, coordinates: true },
    ],
  };
});

const hidden = { includeHiddenElements: true };

async function open(url: string) {
  await renderRouter('./app', { initialUrl: url });
  await act(async () => {});
}

beforeEach(async () => {
  progressStore.getState().reset();
  // M6-settings: a returning learner, past the first-launch intro.
  progressStore.getState().setFlag('onboardingSeen');
  await act(() => setLanguageChoice('en'));
});

describe('locked lessons (AC 56)', () => {
  it('unit 2 with unit 1 at 0★ shows the locked screen', async () => {
    act(() => {
      progressStore.getState().record('u01-test', ['revealed', 'revealed']);
    });
    await open('/lesson/u02-test');
    expect(screen.getByText('Finish the previous unit to open this lesson.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Back to map' })).toBeOnTheScreen();
    expect(screen.queryByTestId('lesson-board')).toBeNull();
  });

  it('unit 1 is open', async () => {
    await open('/lesson/u01-test');
    expect(screen.getByTestId('lesson-board')).toBeTruthy();
  });
});

describe('coordinates (AC 52)', () => {
  it('a lesson with coordinates: true shows them; one without (u01-test) does not', async () => {
    act(() => {
      progressStore.getState().record('u01-test', ['clean', 'clean']);
    });
    await open('/lesson/u02-test');
    expect(screen.getByTestId('board-label-col-A', hidden)).toBeTruthy();
    await open('/lesson/u01-test');
    expect(screen.queryByTestId('board-label-col-A', hidden)).toBeNull();
  });
});
