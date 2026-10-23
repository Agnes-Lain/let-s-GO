// M3 ACs 100, 101, 103, 104: the map with a fixture catalog (units 1–3, a unit-2 checkpoint).
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import { setLanguageChoice } from '@/i18n';
import { progressStore } from '@/store';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('@/lessons/registry', () => {
  const { registryWithSample, SAMPLE_LESSON: sample } = jest.requireActual(
    '@/lessons/__fixtures__/sampleRegistry',
  );
  const actual = registryWithSample();
  const checkpoint = { ...sample, id: 'u02-review', unit: 2, kind: 'checkpoint' };
  delete checkpoint.explain;
  return {
    ...actual,
    LESSON_FILES: [
      { ...sample, id: 'u01-board', unit: 1 },
      { ...sample, id: 'u02-liberties', unit: 2 },
      checkpoint,
      { ...sample, id: 'u03-connect', unit: 3 },
    ],
  };
});

const SIX: ('clean' | 'revealed')[] = Array(6).fill('clean');

async function renderHome() {
  const router = await renderRouter('./app', { initialUrl: '/' });
  await act(async () => {});
  return router;
}
const label = (testID: string) => screen.getByTestId(testID).props.accessibilityLabel;

beforeEach(async () => {
  jest.useFakeTimers();
  progressStore.getState().reset();
  // M6-settings: a returning learner, past the first-launch intro (Home is not redirected).
  progressStore.getState().setFlag('onboardingSeen');
  await act(() => setLanguageChoice('en'));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('fixture catalog (AC 100, 103, 104)', () => {
  beforeEach(() => {
    act(() => {
      progressStore.getState().record('u01-board', SIX);
      progressStore.getState().record('u02-liberties', Array(6).fill('revealed'));
    });
  });

  it('AC 100 / 104: done, available, locked; Continue → unit 2', async () => {
    const router = await renderHome();
    expect(label('home-node-unit-1')).toBe('Unit 1, Board & stones · 棋盘 qípán, 3 of 3 stars');
    expect(label('home-node-unit-2')).toBe('Unit 2, Liberties · 气 qì, not started');
    expect(label('home-node-unit-3')).toBe('Unit 3, Connection · 连接 liánjiē, locked');
    // Units without content and not planned are not listed (since M4 item 2 nothing is planned).
    expect(screen.queryByTestId('home-node-unit-4')).toBeNull();
    expect(screen.queryByTestId('home-node-unit-6')).toBeNull();
    expect(screen.getByText('Unit 2 · Liberties · 气 qì')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('home-continue'));
    expect(router.getPathname()).toBe('/lesson/u02-liberties');
  });

  it('AC 103: the checkpoint sits under unit 2 and is locked until its lesson has 1★', async () => {
    await renderHome();
    expect(label('home-node-checkpoint-2')).toMatch(/^Checkpoint, .*, locked$/);
    act(() => {
      progressStore.getState().record('u02-liberties', SIX);
    });
    expect(label('home-node-checkpoint-2')).toMatch(/^Checkpoint, .*, not started$/);
    // The checkpoint does not gate unit 3 (Q4).
    expect(label('home-node-unit-3')).toMatch(/not started$/);
  });

  it('AC 101: a locked node shows the snackbar for ~2.5 s, announced, without navigating', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
    const router = await renderHome();
    await fireEvent.press(screen.getByTestId('home-node-unit-3'));
    expect(router.getPathname()).toBe('/');
    expect(screen.getByText('Finish the previous unit to open this one.')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('Finish the previous unit to open this one.');
    await act(async () => jest.advanceTimersByTime(2600));
    expect(screen.queryByTestId('home-snackbar')).toBeNull();
  });
});
