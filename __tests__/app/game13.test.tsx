// 13×13 games (spec docs/specs/M6b-13x13-game.md §4.1, 4.4–4.6): the size control and its lock,
// the 13×13 picker numbers, the play route, the 360×740 layout, touch preview / confirm, the
// "Thinking…" notice, Resign while thinking, the hidden review and the stored result.
import { router as appRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import { boardGeometry, pointToLocation } from '@/board';
import { parseVertex } from '@/engine';
import { BOT_DELAY_MS } from '@/game9/session';
import { GAME9_FIXED_HEIGHT, THINKING_NOTICE_MS } from '@/game9/ui/GameScreen';
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
const state = (testID: string) =>
  screen.getByTestId(testID).props.accessibilityState as Record<string, boolean>;

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

/** Stones on the board (no bot move has happened in the tests that use it). */
const blackStones = () => screen.queryAllByTestId(/^board-stone-/);

/** The coordinate tag above the finger ("K10"). */
const tagText = () =>
  screen
    .getByTestId('board-coord-tag-text')
    .queryAll((n) => n.type === 'RNSVGTSpan' && typeof n.props.content === 'string')
    .map((n) => n.props.content as string)
    .join('');

/** A 9×9 win, so 13×13 is open (AC 3). */
const win9 = () => act(async () => progressStore.getState().recordGame(1, 'win', 0));

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

describe('size control (AC 1–4)', () => {
  it('AC 1–2: 9×9 selected first; 13×13 locked with a lock icon; a tap shows the note only', async () => {
    const router = await openAt('/game');
    expect(screen.getByText(texts['game.size.title'])).toBeTruthy();
    expect(state('game-size-9').selected).toBe(true);
    expect(state('game-size-13')).toMatchObject({ selected: false, disabled: true });
    expect(screen.getByTestId('game-size-13-lock')).toBeTruthy();
    expect(flat(screen.getByTestId('game-size-13').props.style).minHeight).toBeGreaterThanOrEqual(
      44,
    );
    expect(screen.queryByTestId('game-size-locked')).toBeNull();
    await press('game-size-13');
    expect(screen.getByTestId('game-size-locked')).toHaveTextContent(texts['game.size.locked']);
    expect(state('game-size-9').selected).toBe(true);
    expect(progressStore.getState().flags.gameSize).toBeUndefined();
    expect(router.getPathname()).toBe('/game');
  });

  it('AC 3–4, 9, 13: after a 9×9 win 13×13 opens with its own badges, chips and suggestion', async () => {
    await win9();
    await act(async () => progressStore.getState().recordGame(3, 'win', 4, 13));
    await openAt('/game');
    expect(screen.queryByTestId('game-size-13-lock')).toBeNull();
    // 9×9: level 1 beaten (the 9×9 win), level 3 not.
    expect(screen.getByTestId('game9-level-1-beaten')).toBeTruthy();
    expect(screen.queryByTestId('game9-level-3-beaten')).toBeNull();
    await press('game-size-13');
    expect(state('game-size-13').selected).toBe(true);
    expect(progressStore.getState().flags.gameSize).toBe(13);
    // 13×13 badges come from bots13 only.
    expect(screen.queryByTestId('game9-level-1-beaten')).toBeNull();
    expect(screen.getByTestId('game9-level-3-beaten')).toBeTruthy();
    expect(screen.getByTestId('game-size-time')).toHaveTextContent(texts['game.size.time13']);
    // Chips Even, 2–5 (no 1, no 6–9); after any win Normal is preselected: 13×13 suggests 4.
    for (const n of [0, 2, 3, 4, 5]) expect(screen.getByTestId(`game9-handicap-${n}`)).toBeTruthy();
    expect(screen.queryByTestId('game9-handicap-1')).toBeNull();
    expect(screen.queryByTestId('game9-handicap-6')).toBeNull();
    expect(screen.getByTestId('game9-handicap-4-suggested')).toBeTruthy();
    expect(state('game9-handicap-4').selected).toBe(true);
    await press('game9-handicap-0');
    expect(screen.getByTestId('game9-handicap-explain')).toHaveTextContent(
      'You play Black and move first. Komi 6.5.',
    );
    await press('game9-handicap-3');
    expect(screen.getByTestId('game9-handicap-explain')).toHaveTextContent(/Komi 0\.5\.$/);
  });

  it('§5.1: switching size keeps the level and resets the handicap to that size’s suggestion', async () => {
    await win9();
    await openAt('/game');
    await press('game9-level-3');
    await press('game9-handicap-2');
    await press('game-size-13');
    expect(state('game9-level-3').selected).toBe(true);
    expect(state('game9-handicap-5').selected).toBe(true);
  });

  it('the picker title follows the size; the Learn card keeps "Play 9×9" (AC 6)', async () => {
    await win9();
    await openAt('/game');
    expect(screen.getByTestId('game9-picker-title')).toHaveTextContent(texts['game9.entry.title']);
    await press('game-size-13');
    expect(screen.getByTestId('game9-picker-title')).toHaveTextContent(texts['game.entry.title13']);
    await press('game-size-9');
    expect(screen.getByTestId('game9-picker-title')).toHaveTextContent(texts['game9.entry.title']);
    expect(texts['game.confirm.desc']).toMatch(/Hint is not available/);
  });

  it('AC 1: the chosen size is remembered on the next visit', async () => {
    await win9();
    await act(async () => progressStore.getState().setGameSize(13));
    await openAt('/game');
    expect(state('game-size-13').selected).toBe(true);
    expect(screen.getByTestId('game-confirm-switch')).toBeTruthy();
  });

  it('the Confirm switch shows only on 13×13', async () => {
    await win9();
    await openAt('/game');
    expect(screen.queryByTestId('game-confirm-switch')).toBeNull();
  });
});

describe('Start and the play route (AC 5, 7, 8)', () => {
  it('AC 5, 8: Start opens /game/play with size 13; header, komi and stones', async () => {
    await win9();
    const router = await openAt('/game');
    await press('game-size-13');
    await press('game9-start');
    expect(router.getPathname()).toBe('/game/play');
    expect(router.getSearchParams()).toMatchObject({ size: '13', level: '2', handicap: '4' });
    expect(screen.getByTestId('game9-header')).toHaveTextContent(
      '13×13 · Normal · 4 stones · Komi 0.5',
    );
    expect(screen.getAllByTestId(/^board-stone-/)).toHaveLength(4);
  });

  it('AC 7: an even 13×13 game: Black first, empty board, Komi 6.5', async () => {
    await openAt('/game/play?level=1&handicap=0&size=13');
    expect(screen.getByTestId('game9-header')).toHaveTextContent('13×13 · Easy · Komi 6.5');
    expect(screen.getByTestId('game9-status-text')).toHaveTextContent(texts['game9.turn.you']);
    expect(screen.queryAllByTestId(/^board-stone-/)).toHaveLength(0);
    expect(screen.getAllByTestId(/^board-grid-v-/)).toHaveLength(13);
  });

  it('AC 5: an invalid size falls back to 9×9', async () => {
    await openAt('/game/play?level=1&size=19');
    expect(screen.getByTestId('game9-header')).toHaveTextContent('Easy · Komi 5.5');
    expect(screen.getAllByTestId(/^board-grid-v-/)).toHaveLength(9);
  });
});

describe('layout and touch at 360×740 (AC 18–24)', () => {
  it('AC 18, 23: the 13×13 board fits without scrolling; stones ≥ 21 px', async () => {
    await openAt('/game/play?level=1&size=13');
    const width = flat(screen.getByTestId('game9-board').props.style).width as number;
    expect(width).toBe(328);
    expect(width + GAME9_FIXED_HEIGHT).toBeLessThanOrEqual(740);
    expect(2 * boardGeometry(13, width, true).stoneRadius).toBeGreaterThanOrEqual(21);
    for (const id of ['game9-hint', 'game9-takeback', 'game9-pass', 'game9-resign']) {
      expect(flat(screen.getByTestId(id).props.style).minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it('AC 19–20: touch-down shows ghost, crosshair and tag; sliding follows; lift commits', async () => {
    await openAt('/game/play?level=1&size=13');
    await touch('responderGrant', locationOf('k10'));
    expect(screen.getByTestId('board-ghost')).toBeTruthy();
    expect(screen.getByTestId('board-crosshair')).toBeTruthy();
    expect(tagText()).toBe('K10');
    expect(blackStones()).toHaveLength(0);
    await touch('responderMove', locationOf('l10'));
    expect(tagText()).toBe('L10');
    await touch('responderRelease', locationOf('l10'));
    expect(blackStones()).toHaveLength(1);
    expect(screen.getByTestId('board-stone-l10')).toBeTruthy();
  });

  it('AC 20: lifting off the board places nothing', async () => {
    await openAt('/game/play?level=1&size=13');
    await touch('responderGrant', locationOf('n13'));
    await touch('responderRelease', { nativeEvent: { locationX: 400, locationY: -40 } });
    expect(blackStones()).toHaveLength(0);
    expect(screen.queryByTestId('board-ghost')).toBeNull();
  });

  it('AC 22: Confirm each move keeps the preview after the lift; Play commits', async () => {
    await win9();
    await openAt('/game/play?level=1&size=13&confirm=1');
    expect(screen.queryByTestId('game9-hint')).toBeNull();
    expect(state('game-confirm-play').disabled).toBe(true);
    expect(
      flat(screen.getByTestId('game-confirm-play').props.style).minHeight,
    ).toBeGreaterThanOrEqual(44);
    await tapBoard('d4');
    expect(blackStones()).toHaveLength(0);
    expect(screen.getByTestId('board-ghost')).toBeTruthy();
    expect(state('game-confirm-play').disabled).toBe(false);
    // Another point moves the preview.
    await tapBoard('k10');
    expect(blackStones()).toHaveLength(0);
    await press('game-confirm-play');
    expect(screen.getByTestId('board-stone-k10')).toBeTruthy();
    expect(screen.queryByTestId('board-ghost')).toBeNull();
  });
});

describe('bot thinking (AC 30–31)', () => {
  it('AC 30: "Thinking…" never before 0.5 s; Resign and Close stay enabled', async () => {
    await openAt('/game/play?level=1&size=13');
    const status = () => screen.getByTestId('game9-status-text');
    await tapBoard('g7');
    expect(status()).toHaveTextContent(texts['game9.turn.bot']);
    await advance(THINKING_NOTICE_MS - 50);
    expect(status()).toHaveTextContent(texts['game9.turn.bot']);
    await advance(100);
    expect(status()).toHaveTextContent(texts['game.thinking']);
    expect(state('game9-pass').disabled).toBe(true);
    expect(state('game9-resign').disabled).toBeFalsy();
    expect(state('game9-close').disabled).toBeFalsy();
    await advance(BOT_DELAY_MS);
    expect(status()).toHaveTextContent(texts['game9.turn.you']);
  });

  it('9×9 keeps its turn line while the bot thinks (no "Thinking…" swap)', async () => {
    await openAt('/game/play?level=1');
    await act(async () => {
      const board = screen.getByTestId('game9-board');
      const width = flat(board.props.style).width as number;
      const { x, y } = pointToLocation(boardGeometry(9, width, true), parseVertex('e5', 9));
      const event = { nativeEvent: { locationX: x, locationY: y } };
      await fireEvent(screen.getByTestId('board-touch'), 'responderGrant', event);
      await fireEvent(screen.getByTestId('board-touch'), 'responderRelease', event);
    });
    await advance(THINKING_NOTICE_MS + 100);
    expect(screen.getByTestId('game9-status-text')).toHaveTextContent(texts['game9.turn.bot']);
  });

  it('AC 30, 38: Resign while the bot thinks ends the game and counts as a 13×13 loss', async () => {
    await openAt('/game/play?level=2&handicap=0&size=13');
    await tapBoard('g7');
    await press('game9-resign');
    await press('game9-resign-confirm');
    expect(screen.getByTestId('game9-result-resigned')).toBeTruthy();
    await advance(BOT_DELAY_MS * 2);
    expect(progressStore.getState().bots13['2']).toMatchObject({ games: 1, wins: 0, handicap: 2 });
    expect(progressStore.getState().bots).toEqual({});
  });

  it('AC 31: leaving while the bot thinks drops its answer without error', async () => {
    const router = await openAt('/game/play?level=1&size=13');
    await tapBoard('g7');
    await press('game9-close');
    await press('game9-leave-confirm');
    await advance(BOT_DELAY_MS * 2);
    expect(router.getPathname()).toBe('/learn');
  });
});

describe('features on 13×13 (AC 37, 41)', () => {
  it('AC 41: the move is announced with its 13×13 label', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await openAt('/game/play?level=1&size=13');
    await tapBoard('k10');
    expect(announce).toHaveBeenCalledWith('Black plays k10.');
  });

  it('AC 37: no Review button after a 13×13 game of 10+ moves', async () => {
    await openAt('/game/play?level=1&size=13');
    // Five learner moves on points the bot has not taken, each with the bot's reply.
    const candidates = ['c3', 'd11', 'k3', 'l11', 'g7', 'c11', 'l3', 'g3', 'g11', 'c7'];
    let played = 0;
    for (const v of candidates) {
      if (played === 5) break;
      if (screen.queryByTestId(`board-stone-${v}`)) continue;
      await tapBoard(v);
      await advance(BOT_DELAY_MS + 50);
      played++;
    }
    expect(screen.getByTestId('game9-move')).toHaveTextContent('Move 10');
    await press('game9-resign');
    await press('game9-resign-confirm');
    expect(screen.getByTestId('game9-again')).toBeTruthy();
    expect(screen.queryByTestId('game9-review')).toBeNull();
  });
});
