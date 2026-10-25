// QA M6b-2: the review of a handicap game starts from the handicap stones (9×9 bug fixed in M6b-2,
// 13×13 AC 25, 28), on both sizes; Prev to the start shows exactly the handicap stones.
import { router as appRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import { boardGeometry, pointToLocation } from '@/board';
import { parseVertex } from '@/engine';
import { BOT_DELAY_MS } from '@/game9/session';
import { setLanguageChoice } from '@/i18n';
import { progressStore } from '@/store';
import { handicapStones } from '@/game9/handicap';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 740, scale: 2, fontScale: 1 }),
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

const settle = async () => act(async () => {});
const advance = async (ms: number) => act(async () => jest.advanceTimersByTime(ms));
const press = async (testID: string) => {
  await act(async () => {
    await fireEvent.press(screen.getByTestId(testID));
  });
};
const flat = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...[style].flat(5).filter(Boolean));

async function openAt(url: string) {
  const router = await renderRouter('./app', { initialUrl: '/' });
  await settle();
  await act(() => appRouter.push(url));
  await settle();
  return router;
}

function locationOf(vertex: string) {
  const board = screen.getByTestId('game9-board');
  const width = flat(board.props.style).width as number;
  const g = boardGeometry(13, width, true);
  const { x, y } = pointToLocation(g, parseVertex(vertex, 13));
  return { nativeEvent: { locationX: x, locationY: y } };
}

async function touch(kind: 'responderGrant' | 'responderMove' | 'responderRelease', event: object) {
  await act(async () => {
    await fireEvent(screen.getByTestId('board-touch'), kind, event);
  });
}

async function tapBoard(vertex: string) {
  const event = locationOf(vertex);
  await touch('responderGrant', event);
  await touch('responderRelease', event);
}

beforeEach(async () => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0.25);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  progressStore.getState().reset();
  progressStore.getState().setFlag('onboardingSeen');
  await act(() => setLanguageChoice('en'));
});

afterEach(async () => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  await act(() => setLanguageChoice('system'));
});

async function playLearnerMoves(n: number, size: 9 | 13) {
  const candidates =
    size === 13
      ? ['c3', 'd11', 'k3', 'l11', 'g7', 'c11', 'l3', 'g3', 'g11', 'c7']
      : ['c3', 'g7', 'c7', 'g3', 'e5', 'b5', 'h5', 'e2', 'e8', 'b8'];
  let played = 0;
  for (const v of candidates) {
    if (played === n) break;
    if (screen.queryByTestId(`board-stone-${v}`)) continue;
    await tapBoard(v);
    await advance(BOT_DELAY_MS + 50);
    played++;
  }
}

describe.each([9, 13] as const)('review of a %i×%i handicap game', (size) => {
  it('starts from the handicap stones, White first, and replays to the end', async () => {
    const extra = size === 13 ? '&size=13' : '';
    await openAt(`/game/play?level=1&handicap=3${extra}`);
    await advance(BOT_DELAY_MS + 50);
    await playLearnerMoves(6, size);
    await press('game9-resign');
    await press('game9-resign-confirm');
    await press('game9-review');
    for (let i = 0; i < 10; i++) await advance(10);
    const total = Number(/of (\d+)$/.exec(screen.getByTestId('review-step').props.children)![1]);
    expect(total).toBeGreaterThanOrEqual(10);
    const finalStones = screen.getAllByTestId(/^board-stone-/).length;
    for (let i = 0; i < total; i++) await press('review-prev');
    const start = screen.getAllByTestId(/^board-stone-/);
    expect(start).toHaveLength(3);
    for (const v of handicapStones(size, 3)) {
      expect(screen.getByTestId(`board-stone-${v}`)).toBeTruthy();
    }
    for (let i = 0; i < total; i++) await press('review-next');
    expect(screen.getAllByTestId(/^board-stone-/)).toHaveLength(finalStones);
  });
});
