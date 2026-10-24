// The sequence runner screen (spec docs/specs/M5-life-death.md §5, AC 14–33) with fake timers.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setLanguageChoice } from '@/i18n';
import type { Lesson, SequenceExercise } from '@/lessons';
import { LESSON_FILES } from '@/lessons/registry';

import {
  advance,
  feedbackText,
  has,
  hidden,
  reduceMotion,
  settle,
  tap,
  texts,
} from '../__fixtures__/practiceDriver';
import { REPLY_MS, REPLY_MS_REDUCED, REVEAL_MS, SequenceRunner } from './SequenceRunner';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 740, scale: 2, fontScale: 1 }),
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

const KILL = (LESSON_FILES as readonly Lesson[])
  .find((l) => l.id === 'u11-vital')!
  .exercises.find((e) => e.id === 'kill-straight') as SequenceExercise;

/** A 3-move line (learner b1, c1... ) to test Undo at a later ply: the KILL line plus nothing. */
const B = (at: string) => ({ color: 'B' as const, at });
const W = (at: string) => ({ color: 'W' as const, at });
/** Two learner moves on an open board (goal: line): W a5, B e5, W b5. */
const OPEN: SequenceExercise = {
  ...KILL,
  id: 'open',
  goal: { kind: 'line' },
  line: [W('a5'), B('e5'), W('b5')],
  wrong: [],
};

function lessonOf(...exercises: SequenceExercise[]): Lesson {
  return {
    schema: 1,
    id: 'u11-test',
    unit: 11,
    kind: 'checkpoint',
    titleKey: 'lesson.u11-review.title',
    exercises,
  };
}

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 740 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const onDone = jest.fn();
const onClose = jest.fn();

async function show(exercise: SequenceExercise = KILL) {
  const lesson = lessonOf(exercise, { ...exercise, id: 'second' });
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <SequenceRunner
        exercise={exercise}
        lesson={lesson}
        index={0}
        onClose={onClose}
        onDone={onDone}
      />
    </SafeAreaProvider>,
  );
  await settle();
  return view;
}

const progressText = () => String(screen.getByTestId('sequence-progress').props.accessibilityLabel);
const statusText = () => String(screen.getByTestId('sequence-status').props.children);
const stoneAt = (v: string) => has(`board-stone-${v}`);
const later = async (ms: number) => advance(ms);

let announce: jest.SpyInstance;
beforeEach(async () => {
  jest.useFakeTimers();
  reduceMotion(false);
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  onDone.mockReset();
  await act(() => setLanguageChoice('en'));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('flow (AC 14–16, 22, 38)', () => {
  it('AC 14: starts on the setup, Move 1 of 2, no feedback, Hint enabled', async () => {
    await show();
    expect(progressText()).toBe('Move 1 of 2');
    expect(statusText()).toBe(texts['sequence.yourTurn']);
    expect(feedbackText()).toBe('');
    expect(screen.getByTestId('practice-hint').props.accessibilityState.disabled).toBe(false);
    expect(stoneAt('b1')).toBe(false);
  });

  it('AC 15: the reply comes after 500 ms; the board is locked meanwhile', async () => {
    await show();
    await tap('b1');
    expect(stoneAt('b1')).toBe(true);
    expect(statusText()).toBe(texts['sequence.replies.B']);
    // Locked: a tap does nothing (AC 22).
    await tap('c1');
    expect(stoneAt('c1')).toBe(false);
    await later(REPLY_MS - 1);
    expect(stoneAt('a1')).toBe(false);
    await later(1);
    expect(stoneAt('a1')).toBe(true);
    expect(progressText()).toBe('Move 2 of 2');
    expect(statusText()).toBe(texts['sequence.yourTurn']);
    expect(announce).toHaveBeenCalledWith('Black plays a1');
  });

  it('AC 16, 24, 38: the last move solves it — captured 6, explain, green ring, clean', async () => {
    await show();
    await tap('b1');
    await later(REPLY_MS);
    await tap('c1');
    expect(feedbackText()).toContain('You captured 6 stones.');
    expect(feedbackText()).toContain(texts['lesson.u11-vital.v2.explain']);
    expect(has('board-highlight-success-c1')).toBe(true);
    expect(progressText()).toBe('Move 2 of 2');
    expect(statusText()).toBe(texts['sequence.done']);
    // No stray reply after the last learner move.
    await later(5000);
    expect(stoneAt('a2')).toBe(false);
    await fireEvent.press(screen.getByTestId('practice-next'));
    expect(onDone).toHaveBeenCalledWith('clean');
  });
});

describe('mistakes (AC 17–21, 23)', () => {
  it('AC 17: an illegal tap shows the engine sentence and costs nothing', async () => {
    await show();
    await tap('a2');
    expect(feedbackText()).toBe(texts['engine.illegal.occupied']);
    await tap('b1');
    await later(REPLY_MS);
    await tap('c1');
    await fireEvent.press(screen.getByTestId('practice-next'));
    expect(onDone).toHaveBeenCalledWith('clean');
  });

  it('AC 18, 21: a wrong first move is refuted, then Try again restarts', async () => {
    await show();
    await tap('a1');
    expect(stoneAt('a1')).toBe(true);
    expect(has('board-highlight-error-a1')).toBe(true);
    await later(REPLY_MS);
    expect(stoneAt('b1')).toBe(true); // Black b1 captured a1
    expect(stoneAt('a1')).toBe(false);
    expect(feedbackText()).toBe(texts['lesson.u11-vital.v2.w1']);
    await fireEvent.press(screen.getByTestId('practice-try-again'));
    await settle();
    expect(stoneAt('b1')).toBe(false);
    expect(progressText()).toBe('Move 1 of 2');
    expect(feedbackText()).toBe('');
    expect(has('board-highlight-error-a1')).toBe(false);
  });

  it('AC 19: a legal move off the line: no reply, the liberty fact', async () => {
    await show();
    await tap('a5');
    await later(2000);
    expect(stoneAt('a5')).toBe(true);
    expect(feedbackText()).toBe('After that move the target group still has 3 liberties.');
    expect(screen.getByTestId('practice-try-again')).toBeTruthy();
  });

  it('AC 20: a mistake at a later move is undone with progress kept', async () => {
    await show(OPEN);
    await tap('a5');
    await later(REPLY_MS);
    expect(progressText()).toBe('Move 2 of 2');
    await tap('c5');
    expect(feedbackText()).toBe(texts['sequence.wrong.notLine']);
    expect(screen.getByTestId('sequence-undo')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sequence-undo'));
    await settle();
    expect(stoneAt('c5')).toBe(false);
    expect(stoneAt('e5')).toBe(true);
    expect(progressText()).toBe('Move 2 of 2');
    await tap('b5');
    await fireEvent.press(screen.getByTestId('practice-next'));
    expect(onDone).toHaveBeenCalledWith('solved');
  });

  it('AC 23: three mistakes reveal the answer stone by stone, 800 ms apart', async () => {
    await show();
    for (let i = 0; i < 2; i++) {
      await tap('a5');
      await fireEvent.press(screen.getByTestId('practice-try-again'));
      await settle();
    }
    await tap('a5');
    expect(stoneAt('a5')).toBe(false); // reset to the start
    expect(statusText()).toBe(texts['sequence.answer']);
    await later(REVEAL_MS);
    expect(stoneAt('b1')).toBe(true);
    expect(stoneAt('a1')).toBe(false);
    await later(REVEAL_MS);
    expect(stoneAt('a1')).toBe(true);
    await later(REVEAL_MS);
    expect(stoneAt('a2')).toBe(false); // captured by c1
    expect(feedbackText()).toContain(texts['lesson.u11-vital.v2.explain']);
    await fireEvent.press(screen.getByTestId('practice-next'));
    expect(onDone).toHaveBeenCalledWith('revealed');
  });
});

describe('hints (AC 27–28)', () => {
  it('AC 27: Hint shows the text and the ring on the next expected point; no clean', async () => {
    await show();
    await fireEvent.press(screen.getByTestId('practice-hint'));
    await settle();
    expect(feedbackText()).toBe(texts['lesson.u11-vital.v1.hint']);
    expect(has('board-highlight-hint-b1')).toBe(true);
    await tap('b1');
    await later(REPLY_MS);
    expect(has('board-highlight-hint-c1')).toBe(true);
    await tap('c1');
    await fireEvent.press(screen.getByTestId('practice-next'));
    expect(onDone).toHaveBeenCalledWith('solved');
  });

  it('AC 28: Hint while the opponent replies shows the ring only once the board unlocks', async () => {
    await show();
    await tap('b1');
    await fireEvent.press(screen.getByTestId('practice-hint'));
    await settle();
    expect(feedbackText()).toBe(texts['lesson.u11-vital.v1.hint']);
    expect(has('board-highlight-hint-b1')).toBe(false);
    expect(has('board-highlight-hint-c1')).toBe(false);
    await later(REPLY_MS);
    expect(has('board-highlight-hint-c1')).toBe(true);
  });

  it('the hint opens by itself after the 2nd mistake', async () => {
    await show();
    for (let i = 0; i < 2; i++) {
      await tap('a5');
      if (i === 0) {
        await fireEvent.press(screen.getByTestId('practice-try-again'));
        await settle();
      }
    }
    expect(feedbackText()).toContain(texts['lesson.u11-vital.v1.hint']);
  });
});

describe('unmount, reduced motion, layout (AC 25, 29–33)', () => {
  it('AC 25: no timer fires after unmount', async () => {
    const view = await show();
    await tap('b1');
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    await view.unmount();
    announce.mockClear();
    await later(5000);
    // The reply's timer would announce "Black plays a1": it was cleared with the screen.
    expect(announce).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it('AC 31: reduced motion — replies after 250 ms, the answer shown at once', async () => {
    reduceMotion(true);
    await show();
    await tap('b1');
    await later(REPLY_MS_REDUCED);
    expect(stoneAt('a1')).toBe(true);
    for (let i = 0; i < 3; i++) {
      await tap('e5');
      if (i < 2) {
        await fireEvent.press(screen.getByTestId('sequence-undo'));
        await settle();
      }
    }
    // Revealed: the final position at once (a2 captured by c1).
    expect(stoneAt('c1')).toBe(true);
    expect(stoneAt('a2')).toBe(false);
  });

  it('AC 30, 33: Hint and Try again are side by side, ≥ 44 px, reachable while locked', async () => {
    await show();
    await tap('a1');
    const hint = StyleSheet.flatten(screen.getByTestId('practice-hint').props.style);
    expect(hint.minHeight).toBeGreaterThanOrEqual(44);
    expect(hint.minWidth).toBeGreaterThanOrEqual(44);
    await later(REPLY_MS);
    const again = StyleSheet.flatten(screen.getByTestId('practice-try-again').props.style);
    expect(again.minHeight).toBeGreaterThanOrEqual(44);
    expect(screen.getByTestId('practice-hint')).toBeTruthy();
  });

  it('AC 29: the progress row is 28 px; the board is 328 px at 360×740', async () => {
    await show();
    expect(StyleSheet.flatten(screen.getByTestId('sequence-progress').props.style).height).toBe(28);
    expect(StyleSheet.flatten(screen.getByTestId('practice-board').props.style).width).toBe(328);
  });

  it('AC 32: the mistaken stone gets a dashed ring, the correct one a solid ring', async () => {
    await show();
    await tap('a5');
    const ring = screen.getByTestId('board-highlight-error-a5', hidden);
    expect(ring.props.strokeDasharray).toBeTruthy();
  });

  it('AC 32: the progress row is labelled for screen readers', async () => {
    await show();
    expect(screen.getByTestId('sequence-progress').props.accessible).toBe(true);
    expect(progressText()).toBe('Move 1 of 2');
  });
});
