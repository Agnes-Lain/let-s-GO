// The Settings "Reduce motion" switch reaches the result screen (docs/specs/M6-settings-onboarding-a11y.md
// AC 13): with the app switch on and the OS off, all stars show at once (no 250 ms steps).
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setLanguageChoice } from '@/i18n';
import { settingsStore } from '@/store';

import { ResultView } from './ResultView';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 740 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const SIX = Array(6).fill('clean') as 'clean'[];

async function show() {
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ResultView
        outcomes={SIX}
        result={{ stars: 3, previousStars: 0, unlockedUnit: null }}
        hasNext={false}
        onNext={jest.fn()}
        onAgain={jest.fn()}
        onReview={jest.fn()}
        onMap={jest.fn()}
      />
    </SafeAreaProvider>,
  );
  await act(async () => {});
}
const filled = () => screen.queryAllByTestId('result-star-filled').length;

beforeEach(async () => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  await act(() => setLanguageChoice('en'));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  act(() => settingsStore.getState().setReduceMotion(false));
});

it('app switch on (OS off): the three stars at once', async () => {
  act(() => settingsStore.getState().setReduceMotion(true));
  await show();
  expect(filled()).toBe(3);
});

it('control: both off, the stars come one by one', async () => {
  await show();
  expect(filled()).toBeLessThan(3);
  await act(async () => jest.advanceTimersByTime(1000));
  expect(filled()).toBe(3);
});
