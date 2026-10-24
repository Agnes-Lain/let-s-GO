// mark and count-entry screens, explanation squares (spec docs/specs/M5-territory-counting.md
// AC 22–49) with fake timers, rendered through ExerciseView like the app does.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { boardGeometry, pointToLocation } from '@/board';
import { parseVertex } from '@/engine';
import { setLanguageChoice } from '@/i18n';
import type { Lesson } from '@/lessons';
import { LESSON_FILES } from '@/lessons/registry';

import {
  advance,
  feedbackText,
  has,
  hidden,
  reduceMotion,
  settle,
} from '../__fixtures__/practiceDriver';
import { ExerciseView } from '../ExerciseView';
import { ExplainPlayer } from '../ExplainPlayer';
import { FLASH_MS } from './types';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 740, scale: 2, fontScale: 1 }),
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

const lesson = (id: string): Lesson =>
  (LESSON_FILES as readonly Lesson[]).find((l) => l.id === id)!;
const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 740 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const onDone = jest.fn();

async function show(lessonId: string, exerciseId: string) {
  const l = lesson(lessonId);
  const index = l.exercises.findIndex((e) => e.id === exerciseId);
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ExerciseView lesson={l} index={index} onClose={jest.fn()} onDone={onDone} />
    </SafeAreaProvider>,
  );
  await settle();
}

/** Tap on a vertex of the practice board (these lessons show coordinates). */
async function tap(vertex: string) {
  const board = screen.getByTestId('practice-board');
  const width = StyleSheet.flatten(board.props.style).width as number;
  const lines = screen.queryAllByTestId(/^board-grid-h-/, hidden).length;
  const size = lines as 5 | 7 | 9;
  const g = boardGeometry(size, width, true);
  const { x, y } = pointToLocation(g, parseVertex(vertex, size));
  const target = screen.getByTestId('board-touch');
  const event = { nativeEvent: { locationX: x, locationY: y } };
  await act(async () => {
    await fireEvent(target, 'responderGrant', event);
  });
  await act(async () => {
    await fireEvent(target, 'responderRelease', event);
  });
}
const press = async (testID: string) => {
  await act(async () => {
    await fireEvent.press(screen.getByTestId(testID));
  });
};
const disabled = (testID: string) =>
  screen.getByTestId(testID).props.accessibilityState?.disabled === true;
const countText = () => String(screen.getByTestId('practice-mark-count').props.children);

beforeEach(async () => {
  jest.useFakeTimers();
  reduceMotion(true);
  onDone.mockClear();
  await act(() => setLanguageChoice('en'));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('mark — territory (AC 22–30, 35, 37)', () => {
  it('AC 22–23: starts empty; a tap adds a black square, a second tap removes it', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await show('u12-territory', 'mark-b-edge');
    expect(countText()).toBe('Marked: 0');
    expect(disabled('practice-check')).toBe(true);
    expect(has('practice-mark-clear')).toBe(false);

    await tap('a3');
    expect(has('board-territory-B-a3')).toBe(true);
    expect(countText()).toBe('Marked: 1');
    expect(disabled('practice-check')).toBe(false);
    expect(announce).toHaveBeenCalledWith('A3 marked as Black territory');

    await tap('a3');
    expect(has('board-territory-B-a3')).toBe(false);
    expect(countText()).toBe('Marked: 0');
    expect(announce).toHaveBeenCalledWith('Mark at A3 removed');
  });

  it('AC 23: White territory uses white squares', async () => {
    await show('u12-territory', 'mark-w-corner');
    await tap('e5');
    expect(has('board-territory-W-e5')).toBe(true);
  });

  it('AC 24: a stone tap is a note, not a mistake (the answer is still clean)', async () => {
    await show('u12-territory', 'mark-b-edge');
    await tap('b3');
    expect(feedbackText()).toBe('Stones are not territory. Tap empty points.');
    expect(countText()).toBe('Marked: 0');
    for (const v of ['a1', 'a2', 'a3', 'a4', 'a5']) await tap(v);
    expect(feedbackText()).toBe('');
    await press('practice-check');
    expect(has('board-highlight-success-a1')).toBe(true);
    expect(feedbackText()).toContain("The 5 empty points in the left column are Black's.");
    await press('practice-next');
    expect(onDone).toHaveBeenCalledWith('clean');
  });

  it('AC 27: P3 — a1..a5 + c3 → c3 is neutral, flashes and goes; the a-marks stay', async () => {
    await show('u12-territory', 'mark-b-dame');
    for (const v of ['a1', 'a2', 'a3', 'a4', 'a5', 'c3']) await tap(v);
    await press('practice-check');
    expect(feedbackText()).toBe('c3 touch both colors: neutral, not territory.');
    expect(has('board-highlight-error-c3')).toBe(true);
    await advance(FLASH_MS);
    expect(has('board-highlight-error-c3')).toBe(false);
    expect(has('board-territory-B-c3')).toBe(false);
    expect(has('board-territory-B-a1')).toBe(true);
    expect(countText()).toBe('Marked: 5');
  });

  // C changed in §12b (PO 2026-10-21): 7 points, so a1 a2 leave 5 to find.
  it('AC 28: C — only a1 a2 → "5 still to find", marks stay', async () => {
    await show('u12-territory', 'mark-b-corner');
    await tap('a1');
    await tap('a2');
    await press('practice-check');
    expect(feedbackText()).toBe('5 still to find.');
    expect(countText()).toBe('Marked: 2');
  });

  it('AC 29–30: hint after the 2nd mistake on hintPoints only; the 3rd reveals the answer', async () => {
    await show('u12-territory', 'mark-b-corner');
    await tap('a1');
    await press('practice-check');
    expect(has('board-highlight-hint-a1')).toBe(false);
    await press('practice-check');
    expect(has('board-highlight-hint-a1')).toBe(true);
    expect(has('board-highlight-hint-b1')).toBe(false);
    expect(feedbackText()).toContain("Black's wall closes off the bottom left.");
    await press('practice-check');
    for (const v of ['a1', 'a2', 'b1', 'b2', 'c1', 'd1', 'e1']) {
      expect(has(`board-territory-B-${v}`)).toBe(true);
    }
    expect(has('practice-check')).toBe(false);
    await press('practice-next');
    expect(onDone).toHaveBeenCalledWith('revealed');
  });

  it('AC 35: Clear removes every mark and counts no mistake', async () => {
    await show('u12-territory', 'mark-b-edge');
    await tap('a1');
    await tap('c3');
    const clear = StyleSheet.flatten(screen.getByTestId('practice-mark-clear').props.style);
    expect(clear.height).toBeGreaterThanOrEqual(44);
    expect(clear.minWidth).toBeGreaterThanOrEqual(44);
    await press('practice-mark-clear');
    expect(countText()).toBe('Marked: 0');
    for (const v of ['a1', 'a2', 'a3', 'a4', 'a5']) await tap(v);
    await press('practice-check');
    await press('practice-next');
    expect(onDone).toHaveBeenCalledWith('clean');
  });
});

describe('mark — dead stones (AC 31–34)', () => {
  it('AC 31–33: N — the wall is marked as a group, then refused with its whyKey; c1 stays', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await show('u14-end', 'dead-both');
    await tap('b1');
    expect(feedbackText()).toBe('Tap a stone.');
    await tap('c1');
    await tap('c2');
    expect(announce).toHaveBeenCalledWith('The group at C2 marked as dead');
    for (const v of ['a2', 'b2', 'c2', 'd2', 'e2', 'c1']) {
      expect(has(`board-marker-dead-${v}`)).toBe(true);
    }
    const stone = screen.getByTestId('board-stone-a2', hidden);
    expect(stone.props.opacity).toBe(0.45);
    await press('practice-check');
    expect(feedbackText()).toBe(
      'This black wall is alive: it has room for two eyes. 1 still to find.',
    );
    await advance(FLASH_MS);
    expect(has('board-marker-dead-a2')).toBe(false);
    expect(has('board-marker-dead-c1')).toBe(true);
    await tap('c5');
    await press('practice-check');
    await press('practice-next');
    expect(onDone).toHaveBeenCalledWith('solved');
  });

  it('AC 34: an alive group without whyKeys → generic line', async () => {
    await show('u14-end', 'dead-1');
    await tap('a3');
    await press('practice-check');
    expect(feedbackText()).toBe('The group at a3 is alive. 1 still to find.');
  });
});

describe('count with a score answer (AC 39–46)', () => {
  it('AC 39–40: entry display, keys 0–9, ⌫; two digits at most; leading 0 replaced', async () => {
    await show('u13-counting', 'area-b');
    const display = () =>
      String(screen.getByTestId('practice-count-display').props.accessibilityLabel);
    expect(display()).toBe('Nothing typed yet');
    expect(disabled('practice-check')).toBe(true);
    expect(disabled('practice-count-backspace')).toBe(true);
    expect(has('practice-chip-0')).toBe(false);
    for (let n = 0; n <= 9; n++) {
      const key = StyleSheet.flatten(screen.getByTestId(`practice-key-${n}`).props.style);
      expect(key.height).toBeGreaterThanOrEqual(44);
    }
    await press('practice-key-0');
    await press('practice-key-1');
    expect(display()).toBe('Your answer: 1');
    await press('practice-key-3');
    await press('practice-key-7');
    expect(display()).toBe('Your answer: 13');
    await press('practice-count-backspace');
    expect(display()).toBe('Your answer: 1');
    expect(disabled('practice-check')).toBe(false);
  });

  it('AC 41: the right number → success, territory squares, Next', async () => {
    await show('u13-counting', 'area-b');
    await press('practice-key-1');
    await press('practice-key-3');
    await press('practice-check');
    expect(has('board-territory-B-a1')).toBe(true);
    expect(has('board-territory-B-d3')).toBe(false);
    expect(feedbackText()).toContain('6 + 7 = 13.');
    await press('practice-next');
    expect(onDone).toHaveBeenCalledWith('clean');
  });

  it('AC 42–43: typed mistakes get their line; the 3rd reveals "6 stones + 7 points = 13."', async () => {
    await show('u13-counting', 'area-b');
    await press('practice-key-6');
    await press('practice-check');
    expect(feedbackText()).toBe('That is only the stones. Add the territory.');
    await press('practice-count-backspace');
    await press('practice-key-1');
    await press('practice-key-5');
    await press('practice-check');
    expect(feedbackText()).toContain('You counted the neutral points too.');
    await press('practice-count-backspace');
    await press('practice-count-backspace');
    await press('practice-key-1');
    await press('practice-key-0');
    await press('practice-check');
    expect(feedbackText()).toContain('6 stones + 7 points = 13.');
    expect(String(screen.getByTestId('practice-count-display').props.accessibilityLabel)).toBe(
      'Your answer: 13',
    );
    expect(has('board-territory-B-a1')).toBe(true);
    await press('practice-next');
    expect(onDone).toHaveBeenCalledWith('revealed');
  });

  it('AC 42 / 44: K — dead c1 is drawn dead from the start; 5 → "take the dead stones off"', async () => {
    await show('u14-end', 'area-dead-b');
    expect(has('board-marker-dead-c1')).toBe(true);
    await press('practice-key-5');
    await press('practice-check');
    expect(feedbackText()).toBe('Take the dead stones off first.');
  });

  it('AC 45: scratch dots toggle and never change the answer', async () => {
    await show('u13-counting', 'area-b-7');
    await tap('a1');
    await tap('b1');
    expect(has('board-scratch-a1')).toBe(true);
    await tap('a1');
    expect(has('board-scratch-a1')).toBe(false);
    expect(has('board-scratch-b1')).toBe(true);
    expect(feedbackText()).toBe('');
    await press('practice-key-2');
    await press('practice-key-5');
    await press('practice-check');
    await press('practice-next');
    expect(onDone).toHaveBeenCalledWith('clean');
  });
});

describe('explanation squares and dead marker (AC 48–49)', () => {
  it('AC 49: u12 s3 — black squares on a, white squares on e, five circles on c', async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ExplainPlayer
          lesson={lesson('u12-territory')}
          stars={0}
          onClose={jest.fn()}
          onStartPractice={jest.fn()}
        />
      </SafeAreaProvider>,
    );
    await settle();
    expect(has('board-territory-B-b5')).toBe(true);
    await press('lesson-next');
    await press('lesson-next');
    for (let r = 1; r <= 5; r++) {
      expect(has(`board-territory-B-a${r}`)).toBe(true);
      expect(has(`board-territory-W-e${r}`)).toBe(true);
      expect(has(`board-marker-circle-c${r}`)).toBe(true);
    }
    expect(has('board-territory-B-b5')).toBe(false);
  });

  it('AC 48: u14 s3 — c1 dimmed with a cross, no square under it', async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ExplainPlayer
          lesson={lesson('u14-end')}
          stars={0}
          onClose={jest.fn()}
          onStartPractice={jest.fn()}
        />
      </SafeAreaProvider>,
    );
    await settle();
    await press('lesson-next');
    await press('lesson-next');
    expect(has('board-marker-dead-c1')).toBe(true);
    expect(screen.getByTestId('board-stone-c1', hidden).props.opacity).toBe(0.45);
    expect(has('board-territory-B-c1')).toBe(false);
    expect(has('board-territory-W-a4')).toBe(true);
  });
});
