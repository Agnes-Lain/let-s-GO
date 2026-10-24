// 9×9 game, screen reader and reduced motion (docs/specs/M6-settings-onboarding-a11y.md AC 14, 37,
// 38; closes M6 bot-levels AC 40 and 41). The bot's moves are scripted so captures are known.
import { router as appRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import { boardGeometry, pointToLocation } from '@/board';
import * as bot from '@/bot';
import { parseVertex, type Move } from '@/engine';
import { BOT_DELAY_MS, BOT_DELAY_REDUCED_MS } from '@/game9/session';
import { setLanguageChoice, type Language } from '@/i18n';
import en from '@/i18n/en.json';
import fr from '@/i18n/fr.json';
import zhCN from '@/i18n/zh-CN.json';
import { progressStore, settingsStore } from '@/store';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 740, scale: 2, fontScale: 1 }),
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));
jest.mock('@/bot', () => {
  const actual = jest.requireActual('@/bot');
  return { ...actual, chooseMove: jest.fn(actual.chooseMove) };
});

const FILES: Record<Language, Record<string, string>> = { 'zh-CN': zhCN, en, fr };
const chooseMove = bot.chooseMove as jest.Mock;
const settle = () => act(async () => {});
const advance = (ms: number) => act(async () => jest.advanceTimersByTime(ms));
const press = async (testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
};
const flat = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...[style].flat(5).filter(Boolean));

/** The bot plays these, in order (then its own choice). */
function script(...moves: (string | 'pass')[]) {
  for (const m of moves) {
    chooseMove.mockImplementationOnce((): { move: Move } => ({
      move:
        m === 'pass'
          ? { type: 'pass', color: 'W' }
          : { type: 'play', color: 'W', point: parseVertex(m, 9) },
    }));
  }
}

async function openGame(level = 1) {
  const router = await renderRouter('./app', { initialUrl: '/' });
  await settle();
  await act(() => appRouter.push(`/game/play?level=${level}`));
  await settle();
  return router;
}

async function tapBoard(vertex: string) {
  const board = screen.getByTestId('game9-board');
  const width = flat(board.props.style).width as number;
  const g = boardGeometry(9, width, true);
  const { x, y } = pointToLocation(g, parseVertex(vertex, 9));
  const target = screen.getByTestId('board-touch');
  const event = { nativeEvent: { locationX: x, locationY: y } };
  await act(async () => {
    fireEvent(target, 'responderGrant', event);
  });
  await act(async () => {
    fireEvent(target, 'responderRelease', event);
  });
}
const moveCount = () => String(screen.getByTestId('game9-move').props.children);

let announce: jest.SpyInstance;

beforeEach(async () => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0.25);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation();
  chooseMove.mockClear();
  progressStore.getState().reset();
  progressStore.getState().setFlag('onboardingSeen');
  // The first-Pass explainer is not under test here.
  progressStore.getState().setFlag('passExplained');
  act(() => settingsStore.getState().setReduceMotion(false));
  await act(() => setLanguageChoice('en'));
});
afterEach(async () => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  act(() => settingsStore.getState().setReduceMotion(false));
  await act(() => setLanguageChoice('system'));
});

describe.each(['en', 'fr', 'zh-CN'] as const)('AC 37 announcements in %s', (lang) => {
  const t = (key: string, params: Record<string, string | number> = {}) =>
    Object.entries(params).reduce(
      (text, [k, v]) => text.replace(`{{${k}}}`, String(v)),
      FILES[lang][key],
    );

  it('each move once; a capture appends the count; pass; marking; the result once', async () => {
    await act(() => setLanguageChoice(lang));
    // White a9, b9 (2 stones, last liberty c9 after Black a8, b8), then passes.
    script('a9', 'b9', 'pass');
    await openGame();
    announce.mockClear();

    await tapBoard('e5');
    expect(announce.mock.calls).toEqual([[t('game9.a11y.played.B', { point: 'e5' })]]);
    await advance(BOT_DELAY_MS + 50);
    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenLastCalledWith(t('game9.a11y.played.W', { point: 'a9' }));

    await tapBoard('a8');
    await advance(BOT_DELAY_MS + 50); // White b9
    await tapBoard('b8');
    await advance(BOT_DELAY_MS + 50); // White passes
    expect(announce).toHaveBeenLastCalledWith(t('game9.a11y.passed.W'));
    announce.mockClear();

    // Black c9 captures the two White stones: one call with the count.
    await tapBoard('c9');
    expect(announce.mock.calls).toEqual([
      [`${t('game9.a11y.played.B', { point: 'c9' })} ${t('game9.a11y.captured', { count: 2 })}`],
    ]);
    // The bot answers with its own (unscripted) move; then Black passes and White passes.
    await advance(BOT_DELAY_MS + 50);
    announce.mockClear();
    script('pass');
    await press('game9-pass');
    expect(announce.mock.calls[0]).toEqual([t('game9.a11y.passed.B')]);
    await advance(BOT_DELAY_MS + 50);
    // White's second pass ends the game: the phase change says "Game over. Mark dead stones."
    // (the ending pass itself is folded into it).
    expect(announce.mock.calls.map((c) => c[0])).toEqual([
      t('game9.a11y.passed.B'),
      t('game9.a11y.over'),
    ]);
    announce.mockClear();
    await press('game9-mark-done');
    await press('game9-count-done');
    // The result is announced once (and the count before it).
    const said = announce.mock.calls.map((c) => c[0]);
    const status = String(screen.getByTestId('game9-status-text').props.children);
    expect(said.filter((s) => s === status)).toHaveLength(1);
    expect(screen.getByTestId('game9-status-text').props.accessibilityLiveRegion).toBe('none');
  });
});

describe('AC 37: a take-back', () => {
  it('the restored move is not announced', async () => {
    await openGame(1);
    await tapBoard('e5');
    await advance(BOT_DELAY_MS + 50);
    announce.mockClear();
    await press('game9-takeback');
    await settle();
    expect(announce).not.toHaveBeenCalled();
  });
});

describe('AC 38: each move is heard once (the board is silent in the game)', () => {
  it('one learner move plus the bot reply → exactly 2 announcements', async () => {
    await openGame();
    announce.mockClear();
    await tapBoard('e5');
    await advance(BOT_DELAY_MS + 50);
    expect(announce).toHaveBeenCalledTimes(2);
  });
});

describe('AC 14: the bot delay (closes M6 bot-levels AC 41)', () => {
  it('reduce motion (app switch) → the reply comes at 300 ms, not before', async () => {
    act(() => settingsStore.getState().setReduceMotion(true));
    await openGame();
    expect(BOT_DELAY_REDUCED_MS).toBe(300);
    await tapBoard('e5');
    expect(moveCount()).toMatch(/1/);
    await advance(299);
    expect(chooseMove).not.toHaveBeenCalled();
    await advance(1);
    expect(chooseMove).toHaveBeenCalledTimes(1);
  });

  it('reduce motion off → the reply comes at 700 ms, not before', async () => {
    await openGame();
    expect(BOT_DELAY_MS).toBe(700);
    await tapBoard('e5');
    await advance(699);
    expect(chooseMove).not.toHaveBeenCalled();
    await advance(1);
    expect(chooseMove).toHaveBeenCalledTimes(1);
  });

  it('OS reduce motion on → 300 ms too', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await openGame();
    await tapBoard('e5');
    await advance(299);
    expect(chooseMove).not.toHaveBeenCalled();
    await advance(1);
    expect(chooseMove).toHaveBeenCalledTimes(1);
  });
});
