// M3 explanation player (spec docs/specs/M3-lesson-framework.md §6.2, ACs 45–57).
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router as appRouter } from 'expo-router';
import { AccessibilityInfo, processColor } from 'react-native';

import { boardWidthFor } from '@/exercises/layout';
import { setLanguageChoice } from '@/i18n';
import en from '@/i18n/en.json';
import { progressStore } from '@/store';
import { stone } from '@/theme/tokens';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

const texts = en as Record<string, string>;
const BLACK_FILL = { type: 0, payload: processColor(stone.black) };

function reduceMotion(value: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(value);
}

/** Stones on the screen as 'B c2', 'W c3', sorted. */
function stones(): string[] {
  return screen
    .queryAllByTestId(/^board-stone-/, { includeHiddenElements: true })
    .map((node) => {
      const black = JSON.stringify(node.props.fill) === JSON.stringify(BLACK_FILL);
      const color = black ? 'B' : 'W';
      return `${color} ${String(node.props.testID).replace('board-stone-', '')}`;
    })
    .sort();
}

const hidden = { includeHiddenElements: true };
const settle = () => act(async () => {});
const advance = (ms: number) => act(async () => jest.advanceTimersByTime(ms));

async function open(url = '/lesson/u00-sample') {
  const router = await renderRouter('./app', { initialUrl: '/' });
  await settle();
  await act(() => appRouter.push(url));
  await settle();
  return router;
}

beforeEach(async () => {
  jest.useFakeTimers();
  reduceMotion(false);
  progressStore.getState().reset();
  await act(() => setLanguageChoice('en'));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('explanation player (sample)', () => {
  it('AC 45: step 1 of 3 — board, liberty, triangle, text, no Back, Next', async () => {
    await open();
    expect(screen.getByTestId('lesson-dots').props.accessibilityLabel).toBe('Step 1 of 3');
    expect(screen.getAllByTestId('lesson-dot-active')).toHaveLength(1);
    expect(screen.getAllByTestId('lesson-dot')).toHaveLength(2);
    expect(stones()).toEqual(['B b3', 'B c2', 'B d3', 'W c3']);
    expect(screen.getByTestId('board-highlight-liberty-c4', hidden)).toBeTruthy();
    expect(screen.getByTestId('board-marker-triangle-c3', hidden)).toBeTruthy();
    expect(screen.getByText(texts['lesson.u00-sample.s1'])).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Next' })).toBeOnTheScreen();
    expect(screen.queryByTestId('lesson-replay')).toBeNull();
  });

  it('AC 46: step 2 plays B c4 after 500 ms and captures W c3', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('lesson-dots').props.accessibilityLabel).toBe('Step 2 of 3');
    expect(stones()).toEqual(['B b3', 'B c2', 'B d3', 'W c3']);
    expect(screen.queryByTestId('board-highlight-liberty-c4', hidden)).toBeNull();
    expect(screen.queryByTestId('board-marker-triangle-c3', hidden)).toBeNull();
    await advance(450);
    expect(stones()).toContain('W c3');
    await advance(100);
    expect(stones()).toEqual(['B b3', 'B c2', 'B c4', 'B d3']);
    expect(screen.getByTestId('board-capture-c3', hidden)).toBeTruthy(); // fading out
    expect(screen.getByText(texts['lesson.u00-sample.s2'])).toBeOnTheScreen();
  });

  it('AC 47–48: step 3 has its own board, captures two stones, then Start practice', async () => {
    const router = await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    await advance(600);
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(stones()).toEqual(['B a3', 'B b2', 'B b4', 'B c2', 'B c4', 'W b3', 'W c3']);
    expect(screen.getByTestId('board-highlight-liberty-d3', hidden)).toBeTruthy();
    await advance(600);
    expect(stones()).toEqual(['B a3', 'B b2', 'B b4', 'B c2', 'B c4', 'B d3']);
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Start practice' }));
    expect(router.getPathname()).toBe('/practice/u00-sample');
  });

  it("AC 49: Back shows the previous step's final position without replaying", async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('lesson-dots').props.accessibilityLabel).toBe('Step 2 of 3');
    expect(stones()).toEqual(['B b3', 'B c2', 'B c4', 'B d3']);
    expect(screen.queryByTestId(/^board-capture-/, hidden)).toBeNull();
    await advance(2000);
    expect(stones()).toEqual(['B b3', 'B c2', 'B c4', 'B d3']);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('lesson-dots').props.accessibilityLabel).toBe('Step 1 of 3');
  });

  it('AC 50: Replay restarts the step from its start position', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    await advance(600);
    await fireEvent.press(screen.getByRole('button', { name: 'Replay' }));
    expect(stones()).toContain('W c3');
    expect(screen.getByTestId('lesson-dots').props.accessibilityLabel).toBe('Step 2 of 3');
    await advance(600);
    expect(stones()).not.toContain('W c3');
  });

  it('AC 51: with Reduce Motion the final position shows at once; Replay redraws instantly', async () => {
    reduceMotion(true);
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(stones()).toEqual(['B b3', 'B c2', 'B c4', 'B d3']);
    expect(screen.queryByTestId(/^board-capture-/, hidden)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Replay' }));
    expect(stones()).toEqual(['B b3', 'B c2', 'B c4', 'B d3']);
  });

  it('AC 52: display-only board without coordinates', async () => {
    await open();
    expect(screen.queryByTestId('board-touch')).toBeNull();
    expect(screen.queryByTestId('board-ghost', hidden)).toBeNull();
    expect(screen.queryByTestId(/^board-label-/, hidden)).toBeNull();
  });

  it('AC 53: ✕ returns Home at once; Skip only with ≥ 1★', async () => {
    const router = await open();
    expect(screen.queryByRole('button', { name: 'Skip to practice' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(router.getPathname()).toBe('/');

    act(() => {
      progressStore.getState().record('u00-sample', ['clean', 'clean', 'clean', 'revealed']);
    });
    await act(() => appRouter.push('/lesson/u00-sample'));
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Skip to practice' }));
    expect(router.getPathname()).toBe('/practice/u00-sample');
  });

  it('AC 54: steps are announced; the dots are one element', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
    await open();
    expect(announce).toHaveBeenCalledWith(`Step 1 of 3. ${texts['lesson.u00-sample.s1']}`);
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(announce).toHaveBeenCalledWith(`Step 2 of 3. ${texts['lesson.u00-sample.s2']}`);
    const dots = screen.getByTestId('lesson-dots');
    expect(dots.props.accessible).toBe(true);
  });

  it('AC 55: an unknown lesson shows the error screen', async () => {
    const router = await open('/lesson/unknown-id');
    expect(screen.getByText("This lesson can't be opened")).toBeOnTheScreen();
    expect(screen.getByText(texts['error.lesson.body'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to map' }));
    expect(router.getPathname()).toBe('/');
  });

  it('AC 57: 328 px board at 360 px; the board area and the 120 px text card never change size', async () => {
    expect(boardWidthFor(360)).toBe(328);
    expect(boardWidthFor(1024)).toBe(480);
    await open();
    const flat = (style: unknown) => Object.assign({}, ...[style].flat(5).filter(Boolean));
    const sizes = () => ({
      board: flat(screen.getByTestId('lesson-board-area').props.style),
      card: flat(screen.getByTestId('lesson-text-card').props.style).height,
    });
    const first = sizes();
    expect(first.board.width).toBe(first.board.height);
    expect(first.card).toBe(120);
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    await advance(520);
    expect(sizes()).toEqual(first);
  });
});
