// 9×9 games against the bot (spec docs/specs/M6-bot-levels.md §4.3–4.6): Home card, level
// picker, the game screen (play, pass, Count now, Resign, mark, count, result) at 360×740.
import { router as appRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { boardGeometry, pointToLocation } from '@/board';
import { parseVertex } from '@/engine';
import { BOT_DELAY_MS } from '@/game9/session';
import { GAME9_FIXED_HEIGHT } from '@/game9/ui/GameScreen';
import { setLanguageChoice } from '@/i18n';
import en from '@/i18n/en.json';
import fr from '@/i18n/fr.json';
import zhCN from '@/i18n/zh-CN.json';
import { progressStore, type LessonProgress } from '@/store';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 740, scale: 2, fontScale: 1 }),
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

const texts = en as Record<string, string>;
const hidden = { includeHiddenElements: true };
const settle = async () => act(async () => {});
const advance = async (ms: number) => act(async () => jest.advanceTimersByTime(ms));
const press = async (testID: string) => {
  await act(async () => {
    await fireEvent.press(screen.getByTestId(testID));
  });
};
const flat = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...[style].flat(5).filter(Boolean));

const STARRED: LessonProgress = {
  stars: 2,
  plays: 1,
  bestClean: 4,
  bestSolved: 5,
  total: 6,
  lastPlayedAt: '2026-10-20T08:00:00.000Z',
};

async function openAt(url: string) {
  const router = await renderRouter('./app', { initialUrl: '/learn' });
  await settle();
  if (url !== '/') {
    await act(() => appRouter.push(url));
    await settle();
  }
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
    await fireEvent(target, 'responderGrant', event);
  });
  await act(async () => {
    await fireEvent(target, 'responderRelease', event);
  });
}

const status = () => screen.getByTestId('game9-status-text');

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

describe('Home card (AC 14; M6-settings AC 61: open from the start)', () => {
  it('a new learner can open the picker at once: no lock, no snackbar, no line', async () => {
    const router = await openAt('/');
    expect(screen.queryByTestId('home-game9-locked')).toBeNull();
    expect(screen.queryByTestId('home-game9-line')).toBeNull();
    expect(screen.getByTestId('home-game9').props.accessibilityState?.disabled).toBeFalsy();
    await press('home-game9');
    expect(screen.queryByTestId('home-snackbar')).toBeNull();
    expect(router.getPathname()).toBe('/game');
  });

  it('opens the level picker once u14-end has a star', async () => {
    await act(async () => progressStore.setState({ lessons: { 'u14-end': STARRED } }));
    const router = await openAt('/');
    const card = screen.getByTestId('home-game9');
    expect(flat(card.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await press('home-game9');
    expect(router.getPathname()).toBe('/game');
  });

  it('lists the beaten levels under the card (§7)', async () => {
    await act(async () => {
      progressStore.setState({ lessons: { 'u14-end': STARRED } });
      progressStore.getState().recordGame(1, 'win');
    });
    await openAt('/');
    expect(screen.getByTestId('home-game9-line')).toHaveTextContent('Beaten: Easy ✓');
  });
});

describe('Level picker (AC 15, 34, 36, 37)', () => {
  it('shows three rows ≥ 64 px with a description; Easy is pre-selected before any win', async () => {
    await openAt('/game');
    for (const level of [1, 2, 3]) {
      const row = screen.getByTestId(`game9-level-${level}`);
      expect(flat(row.props.style).minHeight).toBeGreaterThanOrEqual(64);
      expect(screen.getByText(texts[`game9.level.${level}.desc`])).toBeOnTheScreen();
    }
    expect(screen.getByTestId('game9-level-1').props.accessibilityState.selected).toBe(true);
    // M6-beginner-friendly §5.1: the handicap explanation replaced the "You play Black" caption.
    expect(screen.getByTestId('game9-handicap-explain')).toHaveTextContent(
      'You play Black with 2 stones already placed. White moves first. Komi 0.5.',
    );
  });

  it('QA: the title and the level descriptions wrap instead of being cut (fr at 360 px)', async () => {
    await act(() => setLanguageChoice('fr'));
    await openAt('/game');
    expect(screen.getByTestId('game9-picker-title').props.numberOfLines).toBeUndefined();
    for (const level of [1, 2, 3]) {
      expect(screen.getByTestId(`game9-level-${level}-desc`).props.numberOfLines).toBeUndefined();
    }
  });

  it('after a win Normal is pre-selected; beaten ticks and the Challenge badge show', async () => {
    await act(async () => {
      progressStore.getState().recordGame(1, 'win');
      progressStore.getState().recordGame(3, 'win');
    });
    await openAt('/game');
    expect(screen.getByTestId('game9-level-2').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('game9-level-1-beaten')).toBeOnTheScreen();
    expect(screen.queryByTestId('game9-level-2-beaten')).toBeNull();
    expect(screen.getByTestId('game9-challenge-beaten')).toBeOnTheScreen();
  });

  it('AC 37: three losses in a row at Normal show the tip once', async () => {
    await act(async () => {
      for (let i = 0; i < 3; i++) progressStore.getState().recordGame(2, 'loss');
    });
    await openAt('/game');
    expect(screen.getByTestId('game9-tip')).toBeOnTheScreen();
    expect(progressStore.getState().flags.easierTipShown).toBe(true);
  });

  // M6-beginner-friendly AC 7 replaced "a tap starts the game at once": a tap selects, Start starts.
  it('a tap selects the level; Start starts the game (M6-beginner-friendly AC 7)', async () => {
    const router = await openAt('/game');
    await press('game9-level-3');
    expect(router.getPathname()).toBe('/game');
    await press('game9-handicap-0');
    await press('game9-start');
    expect(router.getPathname()).toBe('/game/play');
    expect(screen.getByTestId('game9-header')).toHaveTextContent('Challenge · Komi 5.5');
  });
});

describe('Game screen (AC 16–24, 38)', () => {
  it('AC 16, 38: an empty 9×9 board of 328 px, Black to play, komi in the header', async () => {
    await openAt('/game/play?level=1');
    expect(screen.getByTestId('game9-header')).toHaveTextContent('Easy · Komi 5.5');
    expect(status()).toHaveTextContent(texts['game9.turn.you']);
    expect(flat(screen.getByTestId('game9-board').props.style).width).toBe(328);
    for (const id of ['game9-pass', 'game9-resign']) {
      expect(flat(screen.getByTestId(id).props.style).minHeight).toBeGreaterThanOrEqual(44);
    }
    // AC 23: no Count now before 6 moves.
    expect(screen.queryByTestId('game9-count-now')).toBeNull();
  });

  it('AC 16–17: after a move the bot thinks (board and buttons locked), then answers', async () => {
    await openAt('/game/play?level=2');
    await tapBoard('e5');
    expect(status()).toHaveTextContent(texts['game9.turn.bot']);
    expect(screen.getByTestId('game9-pass').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('game9-resign').props.accessibilityState.disabled).toBe(true);
    await advance(BOT_DELAY_MS - 50);
    expect(status()).toHaveTextContent(texts['game9.turn.bot']);
    await advance(100);
    expect(status()).toHaveTextContent(texts['game9.turn.you']);
    expect(screen.getByTestId('game9-move')).toHaveTextContent('Move 2');
  });

  it('AC 18: an occupied point shows the engine message', async () => {
    await openAt('/game/play?level=1');
    await tapBoard('e5');
    await advance(BOT_DELAY_MS + 50);
    await tapBoard('e5');
    expect(screen.getByTestId('practice-feedback').props.accessibilityLabel).toBe(
      texts['game.fb.illegal.occupied'],
    );
  });

  it('AC 19: the first Pass explains once, then passes; the bot answers', async () => {
    await openAt('/game/play?level=1');
    await press('game9-pass');
    expect(screen.getByTestId('game9-pass-sheet')).toBeOnTheScreen();
    expect(screen.getByText(texts['game9.passExplain'])).toBeOnTheScreen();
    await press('game9-pass-ok');
    expect(progressStore.getState().flags.passExplained).toBe(true);
    expect(screen.getByTestId('practice-feedback').props.accessibilityLabel).toBe(
      texts['game9.you.passed'],
    );
    await advance(BOT_DELAY_MS + 50);
    // Level 1 opens the board instead of passing (nothing to count yet).
    expect(screen.getByTestId('game9-move')).toHaveTextContent('Move 2');
  });

  it('AC 21, 25–27, 30, 34: Count now → mark → Done → count → a lost game is recorded', async () => {
    await openAt('/game/play?level=1');
    for (const v of ['e5', 'd4', 'c3']) {
      await tapBoard(v);
      await advance(BOT_DELAY_MS + 50);
    }
    expect(screen.getByTestId('game9-move')).toHaveTextContent('Move 6');
    await press('game9-count-now');
    expect(screen.getByTestId('game9-count-sheet')).toBeOnTheScreen();
    await press('game9-count-confirm');
    expect(status()).toHaveTextContent(texts['game9.mark.prompt']);
    expect(screen.getByTestId('game9-mark-count')).toHaveTextContent('Marked: 0');
    await press('game9-mark-done');
    expect(screen.getByTestId('game9-count-table')).toBeOnTheScreen();
    expect(screen.getByTestId('game9-header')).toHaveTextContent(texts['game9.count.title']);
    await press('game9-count-done');
    expect(screen.getByTestId(/^game9-result-/)).toBeOnTheScreen();
    expect(progressStore.getState().bots['1']?.games).toBe(1);
  });

  it('AC 22, 33: Resign → "You resigned"; Show the count is "if we had counted now"', async () => {
    await openAt('/game/play?level=2');
    await press('game9-resign');
    await press('game9-resign-confirm');
    expect(screen.getByTestId('game9-result-resigned')).toBeOnTheScreen();
    expect(progressStore.getState().bots['2']).toMatchObject({ games: 1, wins: 0 });
    await press('game9-show-count');
    expect(screen.getByTestId('game9-hypothetical')).toHaveTextContent(
      texts['game9.result.hypothetical'],
    );
    await press('game9-count-done');
    expect(screen.getByTestId('game9-result-resigned')).toBeOnTheScreen();
    expect(progressStore.getState().bots['2']?.games).toBe(1);
  });

  it('QA: after Resign the "You resigned" sentence shows once; the card says the outcome', async () => {
    await openAt('/game/play?level=2');
    await press('game9-resign');
    await press('game9-resign-confirm');
    expect(screen.getAllByText(texts['game9.result.resigned'])).toHaveLength(1);
    expect(status()).toHaveTextContent(texts['game9.result.resigned']);
    expect(screen.getByTestId('game9-result-resigned')).toHaveTextContent(
      texts['game9.result.lose'],
    );
  });

  it.each(['zh-CN', 'en', 'fr'] as const)(
    'QA (%s): Pass / Resign buttons are short; the sheets carry the term + pinyin',
    async (lang) => {
      await act(() => setLanguageChoice(lang));
      const dict = { 'zh-CN': zhCN, en, fr }[lang] as Record<string, string>;
      // Short enough for three buttons in one row at 360 px (≤ 12 characters, no pinyin).
      for (const key of ['game9.btn.pass', 'game9.btn.resign']) {
        expect(dict[key].length).toBeLessThanOrEqual(12);
        expect(dict[key]).not.toMatch(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/);
      }
      await openAt('/game/play?level=2');
      await press('game9-pass');
      expect(screen.getByTestId('game9-pass-sheet')).toHaveTextContent(dict['game9.pass.title'], {
        exact: false,
      });
      await press('game9-pass-keep');
      await press('game9-resign');
      expect(screen.getByTestId('game9-resign-sheet')).toHaveTextContent(dict['game9.resign.ask'], {
        exact: false,
      });
      if (lang !== 'zh-CN') {
        // PO 2026-10-23: pass 弃权 is a Weiqi term (keeps Chinese); resign and the levels are plain words.
        expect(dict['game9.pass.title']).toContain('弃权 qìquán');
        for (const key of [
          'game9.resign.ask',
          'game9.level.1',
          'game9.level.2',
          'game9.level.3',
          'game9.entry.title',
        ])
          expect({ key, text: dict[key] }).toEqual({
            key,
            text: dict[key].replace(/[\u4e00-\u9fff]/g, ''),
          });
      }
    },
  );

  it('AC 24: ✕ opens the leave sheet; Keep playing stays; nothing is recorded', async () => {
    const router = await openAt('/game/play?level=2');
    await press('game9-close');
    expect(screen.getByTestId('game9-leave-sheet')).toBeOnTheScreen();
    await press('game9-leave-stay');
    expect(router.getPathname()).toBe('/game/play');
    await press('game9-close');
    await press('game9-leave-confirm');
    await settle();
    expect(router.getPathname()).toBe('/learn');
    expect(progressStore.getState().bots).toEqual({});
  });

  it('AC 39: French formats komi with a comma', async () => {
    await act(() => setLanguageChoice('fr'));
    await openAt('/game/play?level=2');
    expect(screen.getByTestId('game9-header')).toHaveTextContent('Normal · Komi 5,5');
  });

  it('AC 38: the fixed parts and the 328 px board fit 740 px without scrolling', async () => {
    await openAt('/game/play?level=2');
    expect(GAME9_FIXED_HEIGHT + 328).toBeLessThanOrEqual(740);
    expect(StyleSheet.flatten(screen.getByTestId('game9-status').props.style).minHeight).toBe(48);
    expect(screen.queryAllByTestId('game9-board', hidden)).toHaveLength(1);
  });
});
