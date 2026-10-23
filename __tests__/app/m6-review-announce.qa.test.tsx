// QA (M6-settings AC 38): a screen that announces moves itself must silence the board. The
// post-game review 复盘 says "Move n of N, Black at e4" on each step; the board must not add a
// second "Black played E4".
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import { boardGeometry, pointToLocation } from '@/board';
import { parseVertex } from '@/engine';
import { BOT_DELAY_MS } from '@/game9/session';
import { setLanguageChoice } from '@/i18n';
import { progressStore } from '@/store';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 740, scale: 2, fontScale: 1 }),
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

const settle = () => act(async () => {});
const advance = (ms: number) => act(async () => jest.advanceTimersByTime(ms));
const press = async (testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
};
const flat = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...[style].flat(5).filter(Boolean));

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
    fireEvent(target, 'responderGrant', event);
  });
  await act(async () => {
    fireEvent(target, 'responderRelease', event);
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
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  progressStore.getState().reset();
  progressStore.getState().setFlag('onboardingSeen');
  await act(() => setLanguageChoice('en'));
});
afterEach(async () => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  await act(() => setLanguageChoice('system'));
});

describe('review announcements (AC 38)', () => {
  // ReviewView passes announce={false} to its GoBoard, so Next says "Move 10 of 10, White at C2"
  // and not also "White played C2".
  it('stepping the review announces each step exactly once', async () => {
    await openGame(1);
    await playUntil(10);
    await resign();
    await press('game9-review');
    for (let i = 0; i < 10; i++) await advance(10);
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation();
    announce.mockClear();
    await press('review-prev');
    expect(announce).toHaveBeenCalledTimes(1);
    announce.mockClear();
    await press('review-next');
    expect(announce.mock.calls.map((c) => c[0])).toEqual([
      expect.stringMatching(/^Move \d+ of \d+, (Black|White) at [A-J]\d$/),
    ]);
  });
});
