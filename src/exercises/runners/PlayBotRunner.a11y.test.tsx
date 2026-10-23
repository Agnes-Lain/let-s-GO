// Capture Go: each move is heard once with a screen reader on (docs/specs/M6-settings-onboarding-a11y.md
// AC 38). The board is silent; the runner says the learner's stone and the bot's reply.
import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setLanguageChoice } from '@/i18n';
import type { Lesson, PlayBotExercise } from '@/lessons';

import { advance, settle, tap } from '../__fixtures__/practiceDriver';
import { BOT_DELAY_MS } from '../botGame';
import { PlayBotRunner } from './PlayBotRunner';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 740, scale: 2, fontScale: 1 }),
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

const exercise: PlayBotExercise = {
  id: 'g0',
  type: 'play-bot',
  size: 5,
  setup: { B: ['b3', 'c2', 'd3'], W: ['c3'] },
  win: { kind: 'captureN', n: 1 },
  bot: { level: 1, blunder: 0, seed: 1 },
  promptKey: 'lesson.u06-capture-go.e1.prompt',
  hintKey: 'lesson.u06-capture-go.e1.hint',
  explainKey: 'lesson.u06-capture-go.e1.explain',
};
const lesson: Lesson = {
  schema: 1,
  id: 'u06-test',
  unit: 6,
  kind: 'checkpoint',
  titleKey: 'lesson.u06-checkpoint.title',
  exercises: [exercise, { ...exercise, id: 'g1' }],
};
const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 740 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

beforeEach(async () => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  await act(() => setLanguageChoice('en'));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('AC 38: one learner move plus the bot reply → exactly 2 announcements', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation();
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <PlayBotRunner
        exercise={exercise}
        lesson={lesson}
        index={0}
        onClose={jest.fn()}
        onDone={jest.fn()}
      />
    </SafeAreaProvider>,
  );
  await settle();
  announce.mockClear();
  // a1 does not capture: the game goes on and the bot replies.
  await tap('a1');
  expect(announce).toHaveBeenCalledTimes(1);
  expect(announce).toHaveBeenLastCalledWith('Black played A1');
  await advance(BOT_DELAY_MS + 50);
  expect(announce).toHaveBeenCalledTimes(2);
  expect(announce.mock.calls[1][0]).toMatch(/^Bot played [a-e]\d/);
});
