// Home modules (docs/specs/M6-settings-onboarding-a11y.md §4.8, §5.5): AC 50, 56–64.
import { render } from '@testing-library/react-native';
import { router as appRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';

import { ModulePath } from '@/exercises/UnitMap';
import { setLanguageChoice } from '@/i18n';
import { getUnits, mapRows, type StarsByLesson } from '@/lessons';
import { progressStore } from '@/store';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));

const hidden = { includeHiddenElements: true };
const settle = () => act(async () => {});
const press = async (testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
};
const expanded = (n: number) =>
  screen.getByTestId(`home-module-${n}`).props.accessibilityState?.expanded as boolean;
const SIX = Array(6).fill('clean') as 'clean'[];
/** Every lesson and checkpoint id in map order. */
const ALL_IDS = mapRows(getUnits(), {}).map((r) => r.lesson?.id as string);

function reduceMotion(value: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(value);
}

function finish(ids: readonly string[]) {
  act(() => {
    for (const id of ids) progressStore.getState().record(id, SIX);
  });
}

async function renderHome() {
  const router = await renderRouter('./app', { initialUrl: '/' });
  await settle();
  return router;
}

beforeEach(async () => {
  reduceMotion(true);
  progressStore.getState().reset();
  progressStore.getState().setFlag('onboardingSeen');
  await act(() => setLanguageChoice('en'));
});
afterEach(async () => {
  jest.restoreAllMocks();
  await act(() => setLanguageChoice('system'));
});

describe('headers and rows (AC 56, 62, 63, 50)', () => {
  it('three headers in order; a new learner sees module 1 open, 2 and 3 collapsed and locked', async () => {
    await renderHome();
    const headers = screen.getAllByTestId(/^home-module-\d$/);
    expect(headers.map((h) => h.props.testID)).toEqual([
      'home-module-1',
      'home-module-2',
      'home-module-3',
    ]);
    expect([expanded(1), expanded(2), expanded(3)]).toEqual([true, false, false]);
    expect(screen.getByTestId('home-node-unit-1')).toBeOnTheScreen();
    expect(screen.getByTestId('home-node-checkpoint-5')).toBeOnTheScreen();
    // Rows of a collapsed module are not rendered (cannot be focused).
    expect(screen.queryByTestId('home-node-unit-6')).toBeNull();
    expect(screen.queryByTestId('home-node-unit-10')).toBeNull();
  });

  it('AC 62: one button per header with expanded state and the full label', async () => {
    await renderHome();
    const one = screen.getByTestId('home-module-1');
    expect(one.props.accessibilityRole).toBe('button');
    expect(one.props.accessibilityState).toEqual({ expanded: true });
    expect(one.props.accessibilityLabel).toBe('Module 1, The basics, Units 1–5, 0 of 6 done');
    expect(screen.getByTestId('home-module-2').props.accessibilityLabel).toBe(
      'Module 2, Playing an opponent, Units 6–9, 0 of 6 done, locked, finish the previous module first',
    );
    expect(screen.getByTestId('home-module-3').props.accessibilityLabel).toBe(
      'Module 3, How to win a game, Units 10–14, 0 of 8 done, locked, finish the previous module first',
    );
    // Chevron, lock and bar are decorative.
    expect(screen.getByTestId('home-module-2-lock', hidden).props['aria-hidden']).toBe(true);
    expect(screen.getByTestId('home-module-1-bar', hidden).props['aria-hidden']).toBe(true);
  });

  it('AC 63: headers are at least 64 px high', async () => {
    await renderHome();
    for (const n of [1, 2, 3]) {
      const style = StyleSheet.flatten(screen.getByTestId(`home-module-${n}`).props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(64);
    }
  });

  it('AC 56: global unit numbers inside modules; rows keep their content and order', async () => {
    await renderHome();
    await press('home-module-2');
    expect(screen.getByTestId('home-node-unit-6').props.accessibilityLabel).toBe(
      'Unit 6, Capture Go · 吃子棋 chīzǐqí, locked',
    );
    await press('home-module-3');
    // Every Home button in order (replaces the M3 AC 102 list; no "Sample (developer)").
    expect(screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
      'Open settings',
      'Start learning, Unit 1 · Board & stones · 棋盘 qípán',
      'Module 1, The basics, Units 1–5, 0 of 6 done',
      'Unit 1, Board & stones · 棋盘 qípán, not started',
      'Unit 2, Liberties · 气 qì, locked',
      'Unit 3, Connection · 连接 liánjiē, locked',
      'Unit 4, Capture · 提子 tízǐ, locked',
      'Unit 5, Atari & escape · 叫吃 jiàochī, locked',
      'Checkpoint, Review, locked',
      'Module 2, Playing an opponent, Units 6–9, 0 of 6 done, locked, finish the previous module first',
      'Unit 6, Capture Go · 吃子棋 chīzǐqí, locked',
      'Checkpoint, Capture Go games, locked',
      'Unit 7, Forbidden points · 禁入点 jìnrùdiǎn, locked',
      'Unit 8, Ko · 打劫 dǎjié, locked',
      'Unit 9, Ladder · 征子 zhēngzi, locked',
      'Checkpoint, Review 2, locked',
      'Module 3, How to win a game, Units 10–14, 0 of 8 done, locked, finish the previous module first',
      'Unit 10, Eyes · 眼 yǎn, locked',
      'Unit 11, Life and death · 死活 sǐhuó, locked',
      'Unit 11, The vital point, locked',
      'Checkpoint, Review 3, locked',
      'Unit 12, Territory · 地 dì, locked',
      'Unit 13, Counting · 数子 shùzǐ, locked',
      'Unit 14, End of game · 终局 zhōngjú, locked',
      'Checkpoint, Review 4, locked',
      // AC 61: the 9×9 card, open from the start, below module 3.
      'Play 9×9',
    ]);
    expect(screen.queryByText('Sample (developer)')).toBeNull();
  });
});

describe('default state (AC 57)', () => {
  it('finished module 1 → module 2 open, 1 and 3 collapsed; 1 shows a check mark', async () => {
    finish(ALL_IDS.slice(0, 6));
    await renderHome();
    expect([expanded(1), expanded(2), expanded(3)]).toEqual([false, true, false]);
    expect(screen.getByTestId('home-module-1').props.accessibilityLabel).toBe(
      'Module 1, The basics, Units 1–5, 6 of 6 done',
    );
    expect(screen.getByTestId('home-module-1-check', hidden)).toBeTruthy();
    expect(screen.getByTestId('home-node-unit-6')).toBeOnTheScreen();
  });

  it('everything done → all collapsed; the 9×9 card and "all done" still show', async () => {
    finish(ALL_IDS);
    await renderHome();
    expect([expanded(1), expanded(2), expanded(3)]).toEqual([false, false, false]);
    expect(screen.getByTestId('home-game9')).toBeOnTheScreen();
    expect(screen.getByTestId('home-all-done')).toBeOnTheScreen();
  });

  it('before hydration: module 1 open as a skeleton; then the default once, keeping toggles', () => {
    const units = getUnits();
    const progress = Object.fromEntries(
      ALL_IDS.slice(0, 6).map((id) => [id, { stars: 1 }]),
    ) as unknown as StarsByLesson;
    const rows = mapRows(units, progress);
    const view = render(
      <ModulePath rows={rows} hydrated={false} onOpen={jest.fn()} onLocked={jest.fn()} />,
    );
    expect(view.getByTestId('home-module-1').props.accessibilityState.expanded).toBe(true);
    expect(view.getAllByTestId('home-skeleton').length).toBe(6);
    // The learner opens module 3 while loading.
    fireEvent.press(view.getByTestId('home-module-3'));
    view.rerender(<ModulePath rows={rows} hydrated onOpen={jest.fn()} onLocked={jest.fn()} />);
    const states = [1, 2, 3].map(
      (n) => view.getByTestId(`home-module-${n}`).props.accessibilityState.expanded,
    );
    expect(states).toEqual([false, true, true]);
    // Applied once: later progress does not move it.
    const later = mapRows(
      units,
      Object.fromEntries(ALL_IDS.map((id) => [id, { stars: 1 }])) as unknown as StarsByLesson,
    );
    view.rerender(<ModulePath rows={later} hydrated onOpen={jest.fn()} onLocked={jest.fn()} />);
    expect(view.getByTestId('home-module-2').props.accessibilityState.expanded).toBe(true);
    view.unmount();
  });
});

describe('toggling (AC 58, 60, 64)', () => {
  it('a tap toggles only that module; several can be open; nothing extra is announced', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderHome();
    await press('home-module-3');
    expect([expanded(1), expanded(2), expanded(3)]).toEqual([true, false, true]);
    await press('home-module-1');
    expect([expanded(1), expanded(2), expanded(3)]).toEqual([false, false, true]);
    expect(screen.queryByTestId('home-node-unit-1')).toBeNull();
    expect(announce).not.toHaveBeenCalled();
  });

  it('AC 58: toggles survive a lesson and back (same session)', async () => {
    const router = await renderHome();
    await press('home-module-2');
    await press('home-module-1');
    await press('home-continue');
    expect(router.getPathname()).toBe('/lesson/u01-board');
    await act(() => appRouter.back());
    await settle();
    expect(router.getPathname()).toBe('/');
    expect([expanded(1), expanded(2), expanded(3)]).toEqual([false, true, false]);
  });

  it('AC 60: a locked module opens to peek; its rows stay locked and show the snackbar; no navigation', async () => {
    const router = await renderHome();
    expect(screen.getAllByText('Locked', hidden)).toHaveLength(2);
    await press('home-module-2');
    expect(router.getPathname()).toBe('/');
    await press('home-node-unit-7');
    expect(screen.getByTestId('home-snackbar')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/');
  });

  it('AC 59: units and progress under the title; a 4 px bar filled by the share done', async () => {
    finish(['u01-board', 'u02-liberties', 'u03-connection']);
    await renderHome();
    expect(screen.getByText('Units 1–5 · 3 of 6 done')).toBeOnTheScreen();
    const bar = screen.getByTestId('home-module-1-bar', hidden);
    expect(StyleSheet.flatten(bar.props.style).height).toBe(4);
    const fill = StyleSheet.flatten(bar.props.children.props.style);
    expect(fill.width).toBe('50%');
  });

  it('AC 64: the chevron turns in 120 ms when motion is allowed, at once with reduce motion', async () => {
    reduceMotion(false);
    const timing = jest.spyOn(Animated, 'timing');
    await renderHome();
    timing.mockClear();
    await press('home-module-2');
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][1]).toMatchObject({ toValue: 1, duration: 120 });
  });

  it('AC 64: reduce motion → no chevron animation', async () => {
    reduceMotion(true);
    const timing = jest.spyOn(Animated, 'timing');
    await renderHome();
    timing.mockClear();
    await press('home-module-2');
    expect(timing).not.toHaveBeenCalled();
  });
});

describe('the 9×9 card (AC 61)', () => {
  it('sits below module 3, outside the modules, visible when module 3 is collapsed', async () => {
    const router = await renderHome();
    expect(expanded(3)).toBe(false);
    const card = screen.getByTestId('home-game9');
    expect(card.props.accessibilityLabel).toBe('Play 9×9');
    await press('home-game9');
    expect(router.getPathname()).toBe('/game');
  });
});
