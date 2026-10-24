// Game coaching on the 9×9 screen (spec docs/specs/M6-game-coaching.md §4.3–4.5, §5): the 提示
// hint button and marker, the note card, and the post-game review 复盘 at 360×740.
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { boardGeometry, pointToLocation } from '@/board';
import { parseVertex } from '@/engine';
import { BOT_DELAY_MS } from '@/game9/session';
import { REVIEW_FIXED_HEIGHT } from '@/game9/ui/ReviewView';
import { setLanguageChoice } from '@/i18n';
import en from '@/i18n/en.json';
import { progressStore } from '@/store';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 740, scale: 2, fontScale: 1 }),
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

const texts = en as Record<string, string>;
const settle = async () => act(async () => {});
const advance = async (ms: number) => act(async () => jest.advanceTimersByTime(ms));
const press = async (testID: string) => {
  await act(async () => {
    await fireEvent.press(screen.getByTestId(testID));
  });
};
const flat = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...[style].flat(5).filter(Boolean));
const label = (testID: string) => screen.getByTestId(testID).props.accessibilityLabel as string;
const diamonds = () =>
  screen.queryAllByTestId(/^board-marker-diamond-/, { includeHiddenElements: true });

async function openGame(level: 1 | 2 | 3) {
  await renderRouter('./app', { initialUrl: `/game/play?level=${level}` });
  await settle();
}

async function tapBoard(vertex: string) {
  const board = screen.getByTestId('game9-board');
  const width = flat(board.props.style).width as number;
  const { x, y } = pointToLocation(boardGeometry(9, width, true), parseVertex(vertex, 9));
  const target = screen.getByTestId('board-touch');
  const event = { nativeEvent: { locationX: x, locationY: y } };
  await act(async () => {
    await fireEvent(target, 'responderGrant', event);
  });
  await act(async () => {
    await fireEvent(target, 'responderRelease', event);
  });
}

const moveCount = () =>
  Number(/\d+/.exec(String(screen.getByTestId('game9-move').props.children))?.[0] ?? 0);

/** Plays learner moves (skipping points the bot took) until the game has `plies` moves. */
async function playUntil(plies: number) {
  const points = ['e5', 'c3', 'g7', 'c7', 'g3', 'e3', 'e7', 'c5', 'g5', 'd4', 'f6', 'd6', 'f4'];
  for (const v of points) {
    if (moveCount() >= plies) return;
    await tapBoard(v);
    await advance(BOT_DELAY_MS + 50);
  }
}

async function resign() {
  await press('game9-resign');
  await press('game9-resign-confirm');
}

beforeEach(async () => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0.25);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  progressStore.getState().reset();
  // M6-settings: a returning learner, past the first-launch intro.
  progressStore.getState().setFlag('onboardingSeen');
  await act(() => setLanguageChoice('en'));
});
afterEach(async () => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  await act(() => setLanguageChoice('system'));
});

describe('Hint 提示 (AC 17–20)', () => {
  it('Normal has no limit; a hint shows a diamond and its reason, then a move removes it', async () => {
    await openGame(2);
    expect(label('game9-hint')).toBe('Hint');
    expect(diamonds()).toHaveLength(0);
    await press('game9-hint');
    expect(label('game9-hint')).toBe('Hint');
    expect(diamonds()).toHaveLength(1);
    expect(diamonds()[0].props.testID).toMatch(/-hint$/);
    expect(label('practice-feedback')).toBe(texts['coach.hint.territory']);
    // AC 18: a second tap changes nothing.
    await press('game9-hint');
    expect(label('game9-hint')).toBe('Hint');
    // AC 19: any move removes it.
    await tapBoard('a9');
    expect(diamonds()).toHaveLength(0);
  });

  it('QA blocker: plural notes and hints render their text, not the raw key', async () => {
    // Math.random is mocked, so the seed and the Easy bot's replies are fixed: after these moves
    // the hint is an atari (plural key coach.hint.atari), and playing it gives coach.you.atari.
    await openGame(1);
    for (const v of ['c3', 'e3', 'd3', 'g3', 'f3', 'g5']) {
      await tapBoard(v);
      await advance(BOT_DELAY_MS + 50);
    }
    await press('game9-hint');
    expect(label('practice-feedback')).toBe('This puts 1 white stone in atari.');
    await tapBoard('f4');
    expect(label('practice-feedback')).toMatch(/^You put 1 stone at [A-J]\d in atari\.$/);
    expect(label('practice-feedback')).not.toMatch(/coach\./);
  });

  it('AC 17: Easy has no limit: no count on the button, still enabled after hints', async () => {
    await openGame(1);
    expect(screen.getByText('Hint')).toBeOnTheScreen();
    for (const v of ['c3', 'g7', 'c7']) {
      await press('game9-hint');
      await tapBoard(v);
      await advance(BOT_DELAY_MS + 50);
    }
    expect(screen.getByTestId('game9-hint').props.accessibilityState.disabled).toBe(false);
    expect(screen.getByText('Hint')).toBeOnTheScreen();
  });

  it('AC 20: Challenge has 3; then "· 0", disabled, "No hints left", still ≥ 44 px', async () => {
    await openGame(3);
    expect(screen.getByText('Hint · 3')).toBeOnTheScreen();
    for (const v of ['c3', 'g7', 'c7']) {
      await press('game9-hint');
      await tapBoard(v);
      await advance(BOT_DELAY_MS + 50);
    }
    const button = screen.getByTestId('game9-hint');
    expect(button.props.accessibilityState.disabled).toBe(true);
    expect(button.props.accessibilityLabel).toBe(texts['coach.hint.none']);
    expect(screen.getByText('Hint · 0')).toBeOnTheScreen();
    expect(StyleSheet.flatten(button.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('AC 20: the button is disabled while the bot thinks', async () => {
    await openGame(1);
    await tapBoard('e5');
    expect(screen.getByTestId('game9-hint').props.accessibilityState.disabled).toBe(true);
    await advance(BOT_DELAY_MS + 50);
    expect(screen.getByTestId('game9-hint').props.accessibilityState.disabled).toBe(false);
  });

  it('AC 15: without a hint the board gets no markers (notes are text only)', async () => {
    await openGame(1);
    await tapBoard('e5');
    await advance(BOT_DELAY_MS + 50);
    expect(screen.getByTestId('game9-board').props.markers).toBeUndefined();
  });
});

describe('Review 复盘 (AC 27, 32–35, §9 #9)', () => {
  it('is hidden for games under 10 moves', async () => {
    await openGame(1);
    await resign();
    expect(screen.getByTestId('game9-result-resigned')).toBeOnTheScreen();
    expect(screen.queryByTestId('game9-review')).toBeNull();
    expect(screen.getByTestId('game9-again')).toBeOnTheScreen();
  });

  it('prepares in chunks, then steps with Prev / Next; ✕ returns to the result', async () => {
    await openGame(1);
    await playUntil(10);
    expect(moveCount()).toBeGreaterThanOrEqual(10);
    await resign();
    expect(screen.getByTestId('game9-home')).toBeOnTheScreen();
    await press('game9-review');
    expect(screen.getByTestId('review-preparing')).toHaveTextContent(
      texts['coach.review.preparing'],
    );
    expect(screen.getByTestId('review-skip')).toBeOnTheScreen();
    expect(screen.getByTestId('review-resigned')).toHaveTextContent(texts['coach.review.resigned']);
    expect(screen.getByTestId('review-hints')).toHaveTextContent('Hints used: 0');
    for (let i = 0; i < 10; i++) await advance(10);
    expect(screen.queryByTestId('review-preparing')).toBeNull();

    const total = screen.getByTestId('review-step').props.children as string;
    expect(total).toMatch(/^Move (\d+) of \1$/);
    expect(screen.getByTestId('review-next').props.accessibilityState.disabled).toBe(true);
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await press('review-prev');
    expect(screen.getByTestId('review-step').props.children).toMatch(/^Move (\d+) of \d+$/);
    expect(announce).toHaveBeenCalledWith(
      expect.stringMatching(/^Move \d+ of \d+, (Black|White) at [A-J]\d$/),
    );
    await press('review-next');
    expect(screen.getByTestId('review-step').props.children).toBe(total);
    // The board is read-only.
    expect(screen.queryByTestId('board-touch')).toBeNull();
    await press('review-close');
    expect(screen.getByTestId('game9-result-resigned')).toBeOnTheScreen();
  });

  it('Skip keeps only the capture moments', async () => {
    await openGame(1);
    await playUntil(10);
    await resign();
    await press('game9-review');
    await press('review-skip');
    expect(screen.queryByTestId('review-preparing')).toBeNull();
    expect(
      screen.queryByTestId('review-quiet') ?? screen.queryByTestId('review-chip-1'),
    ).not.toBeNull();
  });

  it('the review fits 360×740 with a 328 px board', () => {
    expect(REVIEW_FIXED_HEIGHT + 328).toBeLessThanOrEqual(740);
  });
});
