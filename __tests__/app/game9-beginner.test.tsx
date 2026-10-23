// Beginner-friendly 9×9 (spec docs/specs/M6-beginner-friendly.md): the picker's handicap row
// (AC 7–9), the handicap game (AC 2, 4, 13, 14), Take back 悔棋 (AC 15, 19–21), the danger rings
// and the atari line (AC 30, 32, 33, 35), the result's next suggestion (AC 11–12), AC 43 sources.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { router as appRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import { boardGeometry, pointToLocation } from '@/board';
import { parseVertex } from '@/engine';
import { STARTING_HANDICAP } from '@/game9/handicap';
import { BOT_DELAY_MS } from '@/game9/session';
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

describe('picker handicap row (AC 7–9)', () => {
  it('AC 7: three level rows, five chips ≥ 44×48 with one selected, explanation, preview, Start', async () => {
    const router = await openAt('/game');
    for (const level of [1, 2, 3]) expect(screen.getByTestId(`game9-level-${level}`)).toBeTruthy();
    expect(screen.getByText(texts['game9.picker.handicap'])).toBeTruthy();
    const chips = [0, 2, 3, 4, 5].map((n) => `game9-handicap-${n}`);
    for (const id of chips) {
      const style = flat(screen.getByTestId(id).props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
    }
    expect(chips.filter(selected)).toEqual([`game9-handicap-${STARTING_HANDICAP[1]}`]);
    expect(
      screen.getByTestId(`game9-handicap-${STARTING_HANDICAP[1]}-suggested`),
    ).toHaveTextContent(texts['game9.picker.suggested']);
    expect(
      screen.getByTestId('game9-handicap-preview', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(screen.getByTestId('game9-start')).toBeTruthy();
    await press('game9-level-2');
    expect(router.getPathname()).toBe('/game');
  });

  it('AC 8: a level jumps to its suggestion; a chip changes the explanation; Start uses both', async () => {
    const router = await openAt('/game');
    await press('game9-level-3');
    expect(selected(`game9-handicap-${STARTING_HANDICAP[3]}`)).toBe(true);
    await press('game9-handicap-2');
    expect(selected('game9-handicap-2')).toBe(true);
    expect(screen.getByTestId('game9-handicap-explain')).toHaveTextContent(
      'You play Black with 2 stones already placed. White moves first. Komi 0.5.',
    );
    await press('game9-handicap-0');
    expect(screen.getByTestId('game9-handicap-explain')).toHaveTextContent(
      texts['game9.picker.explainEven'],
    );
    await press('game9-handicap-5');
    await press('game9-start');
    expect(router.getPathname()).toBe('/game/play');
    expect(screen.getByTestId('game9-header')).toHaveTextContent('Challenge · 5 stones · Komi 0.5');
    // The choice is for this game only: the stored suggestion is unchanged (AC 8).
    expect(progressStore.getState().bots['3']?.handicap).toBeUndefined();
  });

  it('AC 10: a stored suggestion is pre-selected', async () => {
    await act(async () => progressStore.getState().recordGame(1, 'win', 2));
    await openAt('/game');
    await press('game9-level-1');
    expect(selected('game9-handicap-2')).toBe(true);
  });
});

describe('a handicap game (AC 2, 4, 13, 14)', () => {
  it('3 stones: header, White first, everything locked until the bot has moved', async () => {
    await openAt('/game/play?level=1&handicap=3');
    expect(screen.getByTestId('game9-header')).toHaveTextContent('Easy · 3 stones · Komi 0.5');
    expect(screen.getByTestId('game9-status-text')).toHaveTextContent(texts['game9.turn.bot']);
    for (const id of ['game9-pass', 'game9-resign', 'game9-takeback']) {
      expect(screen.getByTestId(id).props.accessibilityState.disabled).toBe(true);
    }
    await advance(BOT_DELAY_MS + 50);
    expect(screen.getByTestId('game9-move')).toHaveTextContent('Move 1');
    expect(screen.getByTestId('game9-status-text')).toHaveTextContent(texts['game9.turn.you']);
    // History is empty: nothing to take back yet (AC 19).
    expect(screen.getByTestId('game9-takeback').props.accessibilityState.disabled).toBe(true);
  });

  it('AC 14: a malformed handicap plays an even game', async () => {
    await openAt('/game/play?level=1&handicap=7');
    expect(screen.getByTestId('game9-header')).toHaveTextContent('Easy · Komi 5.5');
    expect(screen.getByTestId('game9-status-text')).toHaveTextContent(texts['game9.turn.you']);
  });
});

describe('Take back 悔棋 (AC 15, 20, 21)', () => {
  it('Easy: no number; the first take-back explains itself once, then the short note', async () => {
    await openAt('/game/play?level=1');
    expect(screen.getByTestId('game9-takeback')).toHaveTextContent(/^Take back$/);
    await playAndReply('e5');
    await press('game9-takeback');
    expect(screen.getByTestId('game9-move')).toHaveTextContent('Move 0');
    expect(feedback()).toBe(texts['game9.takeback.first']);
    expect(progressStore.getState().flags.takebackExplained).toBe(true);
    await playAndReply('e5');
    await press('game9-takeback');
    expect(feedback()).toBe(texts['game9.takeback.done']);
  });

  it('Normal: "Take back (3)", then (2)', async () => {
    await openAt('/game/play?level=2');
    expect(screen.getByTestId('game9-takeback')).toHaveTextContent('Take back (3)');
    await playAndReply('e5');
    await press('game9-takeback');
    expect(screen.getByTestId('game9-takeback')).toHaveTextContent('Take back (2)');
  });
});

describe('danger rings and the atari line (AC 30, 32, 33, 35)', () => {
  // With the fixed seed Easy answers e5 → d8, c8 → g4, e8 → d2, d9 → h9: White d8 is in atari.
  it('a dashed tea-green ring on White d8, a diamond on d7, the line; none while the bot thinks', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    await openAt('/game/play?level=1');
    for (const v of ['e5', 'c8', 'e8', 'd9']) await playAndReply(v);
    expect(screen.getByTestId('board-highlight-success-d8')).toBeTruthy();
    expect(screen.getByTestId('board-highlight-success-d8').props.strokeDasharray).toBeDefined();
    expect(screen.getByTestId('board-marker-diamond-d7-chance')).toBeTruthy();
    expect(feedback()).toContain("White's stone at D8 can be captured at D7.");
    expect(screen.getByTestId('board-point-d8').props.accessibilityLabel).toMatch(/in atari$/);
    // AC 32: while the bot thinks, no rings and no line.
    await tapBoard('a1');
    expect(screen.queryByTestId('board-highlight-success-d8')).toBeNull();
    expect(feedback()).not.toContain('D8');
  });
});

describe('the result (AC 11, 12)', () => {
  it('a resignation at 3 stones suggests 4 next time; Play again starts with 4', async () => {
    await openAt('/game/play?level=1&handicap=3');
    await advance(BOT_DELAY_MS + 50);
    await press('game9-resign');
    await press('game9-resign-confirm');
    expect(progressStore.getState().bots['1']?.handicap).toBe(4);
    expect(screen.getByTestId('game9-next-handicap')).toHaveTextContent('Next time: 4 stones.');
    await press('game9-again');
    expect(screen.getByTestId('game9-header')).toHaveTextContent('Easy · 4 stones · Komi 0.5');
  });
});

describe('AC 43: no `accessible={false}` reaches the DOM on web', () => {
  it.each([
    'src/theme/Landscape.tsx',
    'src/game9/ui/Sheet.tsx',
    'src/exercises/LeaveSheet.tsx',
    'src/theme/icons.tsx',
  ])('%s', (file) => {
    const code = readFileSync(join(__dirname, '../..', file), 'utf8');
    expect(code).not.toMatch(/accessible=\{false\}/);
  });
});
