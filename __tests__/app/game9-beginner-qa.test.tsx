// QA for docs/specs/M6-beginner-friendly.md on the game screen: slot priority (AC 34), take-back
// recomputes the rings (AC 25), limits and labels per level (AC 20, 21), handicap result ladder (AC 11, 12).
import { router as appRouter } from 'expo-router';
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
const selected = (testID: string) =>
  screen.getByTestId(testID).props.accessibilityState.selected as boolean;
const feedback = () => screen.getByTestId('practice-feedback').props.accessibilityLabel as string;

async function openAt(url: string) {
  const router = await renderRouter('./app', { initialUrl: '/' });
  await settle();
  await act(() => appRouter.push(url));
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

/** A learner move and the bot's reply. */
async function playAndReply(vertex: string) {
  await tapBoard(vertex);
  await advance(BOT_DELAY_MS + 50);
}

beforeEach(async () => {
  jest.useFakeTimers();
  // newSeed() → the same seed every game, so the bot's replies are fixed.
  jest.spyOn(Math, 'random').mockReturnValue(0.25);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  progressStore.getState().reset();
  await act(() => setLanguageChoice('en'));
});
afterEach(async () => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  await act(() => setLanguageChoice('system'));
});

const ringIds = () =>
  screen.queryAllByTestId(/^board-highlight-(error|success)-/).map((n) => n.props.testID as string);

describe('QA: the one feedback slot and take-back on the game screen', () => {
  // Fixed seed: Easy answers e5 → d8, c8 → g4, e8 → d2, d9 → h9: White d8 is in atari.
  async function toAtari() {
    await openAt('/game/play?level=1');
    for (const v of ['e5', 'c8', 'e8', 'd9']) await playAndReply(v);
    expect(feedback()).toContain("White's stone at D8 can be captured at D7.");
  }

  it('AC 34: an illegal-move reason replaces the atari line; the next move brings the line back', async () => {
    await toAtari();
    await tapBoard('e5'); // occupied
    expect(feedback()).toContain('That point is taken.');
    expect(feedback()).not.toContain('can be captured');
    // rings stay (they are facts about the board) while the reason is shown
    expect(ringIds()).toContain('board-highlight-success-d8');
  });

  it('AC 25: Take back removes the rings of the undone position and says so', async () => {
    await toAtari();
    await press('game9-takeback');
    expect(ringIds()).toEqual([]);
    expect(feedback()).toContain('Taken back');
    expect(feedback()).not.toContain('can be captured');
  });

  it('AC 20–21: Normal counts down 3, 2, 1, 0 and then the button is disabled; Easy has no number', async () => {
    await openAt('/game/play?level=2');
    const label = () => screen.getByTestId('game9-takeback').props.accessibilityLabel as string;
    expect(label()).toBe('Take back (3)');
    for (const [i, v] of ['e5', 'c3', 'g7'].entries()) {
      await playAndReply(v);
      await press('game9-takeback');
      expect(label()).toBe(`Take back (${2 - i})`);
    }
    await playAndReply('e5');
    expect(screen.getByTestId('game9-takeback').props.accessibilityState.disabled).toBe(true);
  });

  it('AC 11, 12: a win chain at 3 stones → 2 → even is suggested; a loss at 5 stays 5', async () => {
    progressStore.getState().recordGame(1, 'win', 2);
    expect(progressStore.getState().bots['1']?.handicap).toBe(2);
    await openAt('/game');
    await press('game9-level-1');
    expect(selected('game9-handicap-2')).toBe(true);
    await act(async () => progressStore.getState().recordGame(2, 'loss', 5));
    await press('game9-level-2');
    expect(selected('game9-handicap-5')).toBe(true);
  });
});

describe('Atari hints switch (PO 2026-10-23)', () => {
  it('is on by default; switched off on the picker, the game shows no rings and no atari line', async () => {
    await openAt('/game');
    expect(screen.getByTestId('game9-atari-hints').props.value).toBe(true);
    await act(async () => {
      fireEvent(screen.getByTestId('game9-atari-hints'), 'valueChange', false);
    });
    expect(progressStore.getState().flags.atariHintsOff).toBe(true);
    await act(() => appRouter.push('/game/play?level=1'));
    await settle();
    // Same fixed seed as above: White d8 ends up in atari.
    for (const v of ['e5', 'c8', 'e8', 'd9']) await playAndReply(v);
    expect(ringIds()).toEqual([]);
    expect(feedback()).not.toContain('can be captured');
  });
});
