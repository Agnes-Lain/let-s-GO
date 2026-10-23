// First-launch intro (docs/specs/M6-settings-onboarding-a11y.md §4.4, §4.6, §5.2): AC 24–33, 46–48.
import { router as appRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, BackHandler, StyleSheet, processColor } from 'react-native';

import { boardGeometry, pointToLocation } from '@/board';
import { parseVertex } from '@/engine';
import { setLanguageChoice, type Language } from '@/i18n';
import en from '@/i18n/en.json';
import fr from '@/i18n/fr.json';
import zhCN from '@/i18n/zh-CN.json';
import { progressStore } from '@/store';
import { stone } from '@/theme/tokens';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 740, scale: 2, fontScale: 1 }),
}));
jest.mock('@/board/sound', () => ({ playStoneSound: jest.fn(() => Promise.resolve()) }));

const FILES: Record<Language, Record<string, string>> = { 'zh-CN': zhCN, en, fr };
const texts = en as Record<string, string>;
const hidden = { includeHiddenElements: true };
const settle = () => act(async () => {});
const press = async (testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
};
const flat = (style: unknown) =>
  (StyleSheet.flatten(style as never) ?? {}) as Record<string, number>;
const SIX = Array(6).fill('clean') as 'clean'[];

/** The latest hardware back handler the screen registered. */
let backHandler: (() => boolean | null | undefined) | null = null;
const systemBack = async () => {
  await act(async () => {
    backHandler?.();
  });
};

async function launch(url = '/') {
  const router = await renderRouter('./app', { initialUrl: url });
  await settle();
  return router;
}

function demoEvent(vertex: string) {
  const board = screen.getByTestId('onboarding-demo-board');
  const width = flat(board.props.style).width as number;
  const g = boardGeometry(5, width, true);
  const { x, y } = pointToLocation(g, parseVertex(vertex, 5));
  return { nativeEvent: { locationX: x, locationY: y } };
}
const touch = (name: 'responderGrant' | 'responderMove' | 'responderRelease', event: object) =>
  act(async () => {
    fireEvent(screen.getByTestId('board-touch'), name, event);
  });
async function tapDemo(vertex: string) {
  const event = demoEvent(vertex);
  await touch('responderGrant', event);
  await touch('responderRelease', event);
}
/** Stones on the demo board as 'B c3', sorted. */
function stones(): string[] {
  const black = JSON.stringify({ type: 0, payload: processColor(stone.black) });
  return screen
    .queryAllByTestId(/^board-stone-/, hidden)
    .map((n) => {
      const color = JSON.stringify(n.props.fill) === black ? 'B' : 'W';
      return `${color} ${String(n.props.testID).replace('board-stone-', '')}`;
    })
    .sort();
}

beforeEach(async () => {
  backHandler = null;
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_name: string, h: never) => {
    backHandler = h;
    return { remove: () => undefined };
  }) as never);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  progressStore.getState().reset();
  await act(() => setLanguageChoice('en'));
});
afterEach(async () => {
  jest.restoreAllMocks();
  await act(() => setLanguageChoice('system'));
});

describe('when the intro shows (AC 25)', () => {
  it('a fresh install opens /onboarding instead of Home', async () => {
    const router = await launch();
    expect(router.getPathname()).toBe('/onboarding');
    expect(screen.getByTestId('onboarding-step-1')).toBeOnTheScreen();
    expect(progressStore.getState().flags).toEqual({});
  });

  it('onboardingSeen → Home', async () => {
    progressStore.getState().setFlag('onboardingSeen');
    const router = await launch();
    expect(router.getPathname()).toBe('/');
  });

  it('an existing player (lesson stars or a bot record) → Home, and no flag is written', async () => {
    act(() => {
      progressStore.getState().record('u01-board', SIX);
    });
    const router = await launch();
    expect(router.getPathname()).toBe('/');
    expect(progressStore.getState().flags).toEqual({});
  });

  it('an existing 9×9 player → Home', async () => {
    act(() => progressStore.getState().recordGame(1, 'loss'));
    const router = await launch();
    expect(router.getPathname()).toBe('/');
    expect(progressStore.getState().flags).toEqual({});
  });
});

describe('step 1 Welcome (AC 46, 48, 32, 36)', () => {
  it('AC 46: title, concept, what-is-Go, the example board, then Start learning', async () => {
    await launch();
    const order = screen.UNSAFE_root.findAll(
      (n) =>
        ((n.type as unknown) === 'Text' && typeof n.props.children === 'string') ||
        n.props.testID === 'onboarding-welcome-board',
    ).map((n) => ((n.type as unknown) === 'Text' ? n.props.children : 'BOARD'));
    const index = (item: string) => order.indexOf(item);
    const sequence = [
      texts['onboarding.1.title'],
      texts['onboarding.1.concept'],
      texts['onboarding.1.body'],
      'BOARD',
      texts['home.start'],
    ].map(index);
    expect(sequence.every((i) => i >= 0)).toBe(true);
    expect(sequence).toEqual([...sequence].sort((a, b) => a - b));
    const board = screen.getByTestId('onboarding-welcome-board');
    expect(board.props.accessibilityLabel).toBe(texts['onboarding.a11y.board1']);
    expect(flat(board.props.style).width).toBe(200);
    // §5.3: Black b3, c3; White c4, d3.
    expect(stones()).toEqual(['B b3', 'B c3', 'W c4', 'W d3']);
  });

  it('AC 48: Skip and Start learning are the only controls; one header', async () => {
    await launch();
    expect(screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
      texts['onboarding.skip'],
      texts['home.start'],
    ]);
    expect(screen.getAllByRole('header')).toHaveLength(1);
    expect(screen.getByRole('header')).toHaveTextContent(texts['onboarding.1.title']);
  });

  it('AC 32: each step announces its title and "Step n of 2"; the dots say it too', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await launch();
    expect(announce).toHaveBeenCalledWith(`${texts['onboarding.1.title']}. Step 1 of 2`);
    expect(screen.getByTestId('onboarding-dots').props.accessibilityLabel).toBe('Step 1 of 2');
    await press('onboarding-next');
    expect(announce).toHaveBeenCalledWith(`${texts['onboarding.2.title']}. Step 2 of 2`);
    expect(screen.getByTestId('onboarding-dots').props.accessibilityLabel).toBe('Step 2 of 2');
    expect(screen.getAllByRole('header')).toHaveLength(1);
  });

  it.each(['zh-CN', 'en', 'fr'] as const)(
    'the copy in %s (zh-CN buttons without pinyin)',
    async (lang) => {
      await act(() => setLanguageChoice(lang));
      await launch();
      const t = FILES[lang];
      expect(screen.getByText(t['onboarding.1.title'])).toBeOnTheScreen();
      expect(screen.getByText(t['onboarding.1.concept'])).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: t['home.start'] })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: t['onboarding.skip'] })).toBeOnTheScreen();
      if (lang === 'zh-CN') {
        for (const key of [
          'onboarding.skip',
          'onboarding.start',
          'onboarding.done',
          'home.start',
        ]) {
          expect(t[key]).not.toMatch(/[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i);
        }
      }
    },
  );
});

describe('steps and leaving (AC 26–28, 31)', () => {
  it('AC 26: Start learning → step 2; system Back → step 1; Back on step 1 = Skip', async () => {
    const router = await launch();
    await press('onboarding-next');
    expect(screen.getByTestId('onboarding-step-2')).toBeOnTheScreen();
    await systemBack();
    expect(screen.getByTestId('onboarding-step-1')).toBeOnTheScreen();
    expect(progressStore.getState().flags.onboardingSeen).toBeUndefined();
    await systemBack();
    expect(router.getPathname()).toBe('/');
    expect(progressStore.getState().flags.onboardingSeen).toBe(true);
  });

  it.each([1, 2])(
    'AC 27: Skip on step %i sets onboardingSeen and replaces the route with Home',
    async (step) => {
      const router = await launch();
      if (step === 2) await press('onboarding-next');
      const skip = screen.getByTestId('onboarding-skip');
      expect(flat(skip.props.style).minHeight).toBeGreaterThanOrEqual(44);
      expect(flat(skip.props.style).minWidth).toBeGreaterThanOrEqual(44);
      await press('onboarding-skip');
      expect(router.getPathname()).toBe('/');
      expect(progressStore.getState().flags.onboardingSeen).toBe(true);
      // Back from Home does not return to the intro.
      expect(appRouter.canGoBack()).toBe(false);
      expect(screen.queryByTestId('onboarding-step-1')).toBeNull();
    },
  );

  it('AC 28, 31: "Go to lesson 1" (always enabled) opens lesson 1, replacing the intro', async () => {
    const router = await launch();
    await press('onboarding-next');
    const finish = screen.getByTestId('onboarding-finish');
    expect(finish.props.accessibilityLabel).toBe(texts['onboarding.start']);
    expect(finish.props.accessibilityState?.disabled).toBe(false);
    await tapDemo('c3');
    expect(screen.getByTestId('onboarding-finish').props.accessibilityState?.disabled).toBe(false);
    await press('onboarding-finish');
    expect(router.getPathname()).toBe('/lesson/u01-board');
    expect(progressStore.getState().flags.onboardingSeen).toBe(true);
    expect(appRouter.canGoBack()).toBe(false);
  });

  it('AC 28 / §5.4 replay: Done returns to Settings; Skip too; no progress changes', async () => {
    progressStore.getState().setFlag('onboardingSeen');
    act(() => {
      progressStore.getState().record('u01-board', SIX);
    });
    const before = JSON.stringify(progressStore.getState().lessons);
    const router = await launch('/settings');
    await press('settings-intro');
    expect(router.getPathname()).toBe('/onboarding');
    await press('onboarding-next');
    expect(screen.getByTestId('onboarding-finish').props.accessibilityLabel).toBe(
      texts['onboarding.done'],
    );
    await press('onboarding-finish');
    expect(router.getPathname()).toBe('/settings');
    await press('settings-intro');
    await press('onboarding-skip');
    expect(router.getPathname()).toBe('/settings');
    expect(JSON.stringify(progressStore.getState().lessons)).toBe(before);
    expect(progressStore.getState().flags).toEqual({ onboardingSeen: true });
  });
});

describe('step 2 demo (AC 29, 30, 32, 33)', () => {
  async function openDemo() {
    await launch();
    await press('onboarding-next');
  }

  it('AC 29: touch-down on c3 shows the ghost and no stone; touch-up places Black c3 + done line', async () => {
    await openDemo();
    const board = screen.getByTestId('onboarding-demo-board');
    expect(board.props.accessibilityLabel).toBe(texts['onboarding.a11y.demo']);
    expect(flat(board.props.style).width).toBeGreaterThanOrEqual(280);
    const event = demoEvent('c3');
    await touch('responderGrant', event);
    expect(screen.getAllByTestId('board-ghost', hidden)).toHaveLength(1);
    expect(stones()).toEqual([]);
    expect(screen.queryByTestId('onboarding-demo-done')).toBeNull();
    await touch('responderRelease', event);
    expect(stones()).toEqual(['B c3']);
    expect(screen.queryAllByTestId('board-ghost', hidden)).toHaveLength(0);
    expect(screen.getByTestId('onboarding-demo-done')).toHaveTextContent(
      texts['onboarding.2.done'],
    );
  });

  it('AC 29: touch-down, slide off the board, lift → nothing is placed', async () => {
    await openDemo();
    await touch('responderGrant', demoEvent('c3'));
    const off = { nativeEvent: { locationX: -200, locationY: -200 } };
    await touch('responderMove', off);
    expect(screen.queryAllByTestId('board-ghost', hidden)).toHaveLength(0);
    await touch('responderRelease', off);
    expect(stones()).toEqual([]);
    expect(screen.queryByTestId('onboarding-demo-done')).toBeNull();
  });

  it('AC 30: an occupied point gets the engine message; colours alternate', async () => {
    await openDemo();
    await tapDemo('c3');
    await tapDemo('c3');
    expect(screen.getByTestId('onboarding-demo-illegal')).toHaveTextContent(
      texts['engine.illegal.occupied'],
    );
    expect(stones()).toEqual(['B c3']);
    await tapDemo('d3');
    expect(stones()).toEqual(['B c3', 'W d3']);
    await tapDemo('b2');
    expect(stones()).toEqual(['B b2', 'B c3', 'W d3']);
    expect(screen.getByTestId('onboarding-demo-done')).toBeOnTheScreen();
  });

  it('AC 33 (J): Skip and the button ≥ 44 px; the final button 52 px', async () => {
    await openDemo();
    expect(flat(screen.getByTestId('onboarding-finish').props.style).minHeight).toBe(52);
  });
});

describe('Home has no welcome banner (AC 47)', () => {
  it('a new learner who skipped sees the map with "Start learning" → lesson 1', async () => {
    const router = await launch();
    await press('onboarding-skip');
    expect(screen.queryByText(texts['onboarding.1.title'])).toBeNull();
    expect(screen.queryByText(texts['onboarding.1.concept'])).toBeNull();
    const card = screen.getByTestId('home-continue');
    expect(card.props.accessibilityLabel).toMatch(/^Start learning, Unit 1/);
    await press('home-continue');
    expect(router.getPathname()).toBe('/lesson/u01-board');
  });
});
