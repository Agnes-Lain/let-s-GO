// The sequence runner with search judging (spec docs/specs/M5-sequence-v2.md AC 14–23), fake timers.
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
import { REPLY_MS, REVEAL_MS, SequenceRunner } from './SequenceRunner';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 740, scale: 2, fontScale: 1 }),
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

const find = (lessonId: string, id: string) =>
  (LESSON_FILES as readonly Lesson[])
    .find((l) => l.id === lessonId)!
    .exercises.find((e) => e.id === id) as SequenceExercise;
const LADDER = find('u09-ladder', 'ladder-play');
const CORNER = find('u09-ladder', 'ladder-play-corner');

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 740 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const onDone = jest.fn();

async function show(exercise: SequenceExercise = LADDER) {
  // Without coordinates, so the shared `tap` driver hits the right points.
  const lesson: Lesson = {
    schema: 1,
    id: 'u09-test',
    unit: 9,
    kind: 'checkpoint',
    titleKey: 'lesson.u09-review.title',
    exercises: [exercise, { ...exercise, id: 'second' }],
  };
  const view = render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <SequenceRunner
        exercise={exercise}
        lesson={lesson}
        index={0}
        onClose={() => {}}
        onDone={onDone}
      />
    </SafeAreaProvider>,
  );
  await settle();
  return view;
}

const progressText = () => String(screen.getByTestId('sequence-progress').props.accessibilityLabel);
const stoneAt = (v: string) => has(`board-stone-${v}`);

/** Plays learner moves, each followed by the reply delay. */
async function play(...moves: string[]) {
  for (const at of moves) {
    await tap(at);
    await advance(REPLY_MS);
  }
}

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

describe('search-judged runner (M5-sequence-v2 AC 14–23)', () => {
  it('AC 14: Move 1 of 4, Hint enabled', async () => {
    await show();
    expect(progressText()).toBe('Move 1 of 4');
    expect(screen.getByTestId('practice-hint').props.accessibilityState.disabled).toBe(false);
  });

  it('AC 15–16: the whole line, reply after 500 ms each, then solved with 4 captured, clean', async () => {
    await show();
    await tap('c4');
    await advance(REPLY_MS - 1);
    expect(stoneAt('d3')).toBe(false);
    await advance(1);
    expect(stoneAt('d3')).toBe(true);
    expect(progressText()).toBe('Move 2 of 4');
    await play('e3', 'd5');
    expect(progressText()).toBe('Move 4 of 4');
    await tap('e5');
    expect(feedbackText()).toContain('You captured 4 stones.');
    expect(feedbackText()).toContain(texts['lesson.u09-ladder.e8.explain']);
    expect(has('board-highlight-success-e5')).toBe(true);
    await advance(5000);
    fireEvent.press(screen.getByTestId('practice-next'));
    expect(onDone).toHaveBeenCalledWith('clean');
  });

  it('AC 19: the other atari d4 is never "wrong"; the e4/e2 branch solves it', async () => {
    await show();
    await play('c4', 'd4');
    expect(stoneAt('e3')).toBe(true);
    expect(feedbackText()).toBe('');
    await play('e4');
    expect(stoneAt('e2')).toBe(true);
    await tap('e1');
    expect(feedbackText()).toContain('You captured 4 stones.');
    fireEvent.press(screen.getByTestId('practice-next'));
    expect(onDone).toHaveBeenCalledWith('clean');
  });

  it('AC 17–18: a rejected first move: the reply after 500 ms, dashed ring, two facts, Try again', async () => {
    await show();
    await tap('d3');
    expect(stoneAt('d3')).toBe(true);
    expect(has('board-highlight-error-d3')).toBe(true);
    expect(screen.queryByTestId('practice-try-again')).toBeNull();
    await advance(REPLY_MS);
    expect(stoneAt('c4')).toBe(true);
    expect(feedbackText()).toBe(
      `${texts['sequence.wrong.atariButEscapes']} After the reply, the group has 3 liberties.`,
    );
    const ring = screen.getByTestId('board-highlight-error-d3', hidden);
    expect(ring.props.strokeDasharray).toBeTruthy();
    // Locked until Try again.
    await tap('e5');
    expect(stoneAt('e5')).toBe(false);
    fireEvent.press(screen.getByTestId('practice-try-again'));
    await settle();
    expect(stoneAt('d3')).toBe(false);
    expect(stoneAt('c4')).toBe(false);
    expect(progressText()).toBe('Move 1 of 4');
  });

  it('AC 17–18: the slow atari e4 at move 3: reply d5, "2 liberties", Undo keeps progress', async () => {
    await show();
    await play('c4', 'e3');
    await tap('e4');
    await advance(REPLY_MS);
    expect(stoneAt('d5')).toBe(true);
    expect(feedbackText()).toBe(
      `${texts['sequence.wrong.atariButEscapes']} After the reply, the group has 2 liberties.`,
    );
    // Two short lines fit the 72 px card at 360 px (5×5).
    expect(StyleSheet.flatten(screen.getByTestId('practice-feedback').props.style).height).toBe(72);
    expect(screen.getAllByTestId('practice-feedback-error', hidden)).toHaveLength(2);
    fireEvent.press(screen.getByTestId('sequence-undo'));
    await settle();
    expect(stoneAt('e4')).toBe(false);
    expect(stoneAt('d5')).toBe(false);
    expect(stoneAt('d4')).toBe(true);
    expect(progressText()).toBe('Move 3 of 4');
    await play('d5');
    await tap('e5');
    fireEvent.press(screen.getByTestId('practice-next'));
    expect(onDone).toHaveBeenCalledWith('solved');
  });

  it('AC 18: the two-line feedback on 7×7 at 360 px', async () => {
    await show(CORNER);
    await tap('f5');
    await advance(REPLY_MS);
    expect(stoneAt('e6')).toBe(true);
    expect(screen.getAllByTestId('practice-feedback-error', hidden)).toHaveLength(2);
    expect(StyleSheet.flatten(screen.getByTestId('practice-feedback').props.style).height).toBe(72);
    expect(StyleSheet.flatten(screen.getByTestId('practice-board').props.style).width).toBe(328);
  });

  it('AC 20: the hint ring follows the position (e2 after c4 d3 d4 e3)', async () => {
    await show();
    fireEvent.press(screen.getByTestId('practice-hint'));
    await settle();
    expect(feedbackText()).toBe(texts['lesson.u09-ladder.e8.hint']);
    expect(has('board-highlight-hint-c4')).toBe(true);
    await play('c4');
    expect(has('board-highlight-hint-e3')).toBe(true);
    await play('d4');
    expect(has('board-highlight-hint-e2')).toBe(true);
  });

  it('AC 21: three mistakes reveal the canonical line, 800 ms apart', async () => {
    await show();
    for (let i = 0; i < 2; i++) {
      await tap('d3');
      await advance(REPLY_MS);
      fireEvent.press(screen.getByTestId('practice-try-again'));
      await settle();
    }
    await tap('d3');
    await advance(REPLY_MS);
    expect(stoneAt('d3')).toBe(false); // reset to the start
    await advance(REVEAL_MS);
    expect(stoneAt('c4')).toBe(true);
    await advance(REVEAL_MS * 6);
    expect(stoneAt('e5')).toBe(true);
    expect(stoneAt('c3')).toBe(false);
    expect(feedbackText()).toContain(texts['lesson.u09-ladder.e8.explain']);
    fireEvent.press(screen.getByTestId('practice-next'));
    expect(onDone).toHaveBeenCalledWith('revealed');
  });

  it('AC 22: an illegal tap shows the engine sentence and costs nothing', async () => {
    await show();
    await tap('c3');
    expect(feedbackText()).toBe(texts['engine.illegal.occupied']);
    await play('c4', 'e3', 'd5');
    await tap('e5');
    fireEvent.press(screen.getByTestId('practice-next'));
    expect(onDone).toHaveBeenCalledWith('clean');
  });

  it('AC 23: no timer fires after unmount (accepted and rejected moves)', async () => {
    for (const first of ['c4', 'd3']) {
      const view = await show();
      await tap(first);
      const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
      view.unmount();
      announce.mockClear();
      await advance(5000);
      expect(announce).not.toHaveBeenCalled();
      expect(errors).not.toHaveBeenCalled();
      errors.mockRestore();
    }
  });
});
