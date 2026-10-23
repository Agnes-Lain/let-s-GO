// QA (M6-settings AC 13): the Settings "Reduce motion" switch (OS off) reaches ExplainPlayer: the
// step's final position shows at once and the capture fade is skipped. Mirrors lesson.test AC 51.
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router as appRouter } from 'expo-router';
import { AccessibilityInfo, processColor } from 'react-native';

import { setLanguageChoice } from '@/i18n';
import { progressStore, settingsStore } from '@/store';
import { stone } from '@/theme/tokens';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('@/lessons/registry', () =>
  jest.requireActual('@/lessons/__fixtures__/sampleRegistry').registryWithSample(),
);
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

const BLACK_FILL = { type: 0, payload: processColor(stone.black) };
const stones = () =>
  screen
    .queryAllByTestId(/^board-stone-/, { includeHiddenElements: true })
    .map(
      (n) =>
        `${JSON.stringify(n.props.fill) === JSON.stringify(BLACK_FILL) ? 'B' : 'W'} ${String(n.props.testID).replace('board-stone-', '')}`,
    )
    .sort();
const settle = () => act(async () => {});
const advance = (ms: number) => act(async () => jest.advanceTimersByTime(ms));

async function open() {
  await renderRouter('./app', { initialUrl: '/' });
  await settle();
  await act(() => appRouter.push('/lesson/u00-sample'));
  await settle();
}

beforeEach(async () => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  progressStore.getState().reset();
  progressStore.getState().setFlag('onboardingSeen');
  await act(() => setLanguageChoice('en'));
});
afterEach(() => {
  act(() => settingsStore.getState().setReduceMotion(false));
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('ExplainPlayer and the app reduce-motion switch (AC 13)', () => {
  it('app switch on: the final position shows at once, no capture fade', async () => {
    act(() => settingsStore.getState().setReduceMotion(true));
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(stones()).toEqual(['B b3', 'B c2', 'B c4', 'B d3']);
    expect(screen.queryByTestId(/^board-capture-/, { includeHiddenElements: true })).toBeNull();
  });

  it('control, switch off: the captured stone is still there until the replay runs', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(stones()).toContain('W c3');
    await advance(2000);
    expect(stones()).toEqual(['B b3', 'B c2', 'B c4', 'B d3']);
  });
});
