// Home = learning-path map (M0 ACs 15–19, M3 ACs 97–99, 101–102, 105–106) on the real catalog.
import { render } from '@testing-library/react-native';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { UnitPath } from '@/exercises/UnitMap';
import { setLanguageChoice, type Language } from '@/i18n';
import { getUnits, mapRows } from '@/lessons';
import { progressStore } from '@/store';

// Device locale: Simplified Chinese (the primary language).
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'zh-Hans-CN', languageCode: 'zh' }],
}));

const hidden = { includeHiddenElements: true };

async function renderHome(language: Language) {
  await act(() => setLanguageChoice(language));
  const router = await renderRouter('./app', { initialUrl: '/' });
  await act(async () => {});
  return router;
}

beforeEach(() => {
  progressStore.getState().reset();
});
afterEach(async () => {
  await act(() => setLanguageChoice('system'));
});

describe('Home screen (M0 copy)', () => {
  it('shows the zh-CN home content (AC15)', async () => {
    const router = await renderHome('zh-CN');
    expect(router.getPathname()).toBe('/');
    expect(screen.getByText("Let's GO")).toBeOnTheScreen();
    expect(screen.getByText('从零开始，一步一步学会下围棋')).toBeOnTheScreen();
    expect(screen.getByText('学习路线')).toBeOnTheScreen();
    expect(screen.getByText('第 1 单元')).toBeOnTheScreen();
    expect(screen.getByText('棋盘与棋子')).toBeOnTheScreen();
    // M5 item 1: Units 7–9 have content; only Unit 10 is "coming soon" (plus the footer).
    // M5 item 4: Units 12–14 ship; no unit is "coming soon", only the footer stays.
    expect(screen.queryAllByText('即将开放')).toHaveLength(0);
    expect(screen.getAllByText('眼').length).toBeGreaterThan(0);
    expect(screen.getAllByText('吃子棋').length).toBeGreaterThan(0);
    expect(screen.getByText('更多单元即将上线')).toBeOnTheScreen();
  });

  it('shows the English and French home content (AC16)', async () => {
    await renderHome('en');
    expect(
      screen.getByText('Learn Go (围棋 wéiqí) from zero, one rule at a time'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Learning path')).toBeOnTheScreen();
    expect(screen.getByText('Board & stones · 棋盘 qípán')).toBeOnTheScreen();
    await act(() => setLanguageChoice('fr'));
    expect(screen.getByText("Parcours d'apprentissage")).toBeOnTheScreen();
    expect(screen.getByText('Plateau et pierres · 棋盘 qípán')).toBeOnTheScreen();
    expect(screen.queryAllByText('Bientôt disponible')).toHaveLength(0);
    expect(screen.getByText('Les yeux · 眼 yǎn')).toBeOnTheScreen();
    expect(screen.getByText('Jeu de capture · 吃子棋 chīzǐqí')).toBeOnTheScreen();
  });

  it('opens Settings from the gear button (AC18)', async () => {
    const router = await renderHome('en');
    await fireEvent.press(screen.getByRole('button', { name: 'Open settings' }));
    expect(router.getPathname()).toBe('/settings');
  });

  it('draws the decorative landscape hidden from accessibility and touches', async () => {
    await renderHome('zh-CN');
    const landscape = screen.getByTestId('landscape-home', hidden);
    expect(landscape.props.accessible).toBe(false);
    expect(landscape.props.pointerEvents).toBe('none');
  });
});

describe('learning path, dev build (AC 97, 99, 101–102, 106)', () => {
  it('AC 97 / M4 AC 14, 16: fresh install — Start learning → sample; sample and Unit 1 available; 2–6 locked', async () => {
    const router = await renderHome('en');
    const card = screen.getByTestId('home-continue');
    expect(card.props.accessibilityLabel).toBe('Start learning, Sample (developer)');
    expect(screen.getByTestId('home-node-unit-0').props.accessibilityLabel).toBe(
      'Sample (developer), Sample: Capture, not started',
    );
    // The sample does not gate Unit 1 (M4 AC 16).
    expect(screen.getAllByTestId('home-dot-available')).toHaveLength(2);
    expect(screen.getByTestId('home-node-unit-1').props.accessibilityLabel).toBe(
      'Unit 1, Board & stones · 棋盘 qípán, not started',
    );
    for (let n = 2; n <= 6; n++) {
      expect(screen.getByTestId(`home-node-unit-${n}`).props.accessibilityLabel).toMatch(/locked$/);
    }
    expect(screen.getByTestId('home-node-checkpoint-5').props.accessibilityLabel).toBe(
      'Checkpoint, Review, locked',
    );
    // M4 item 2 (AC 58, 59): Unit 6 is a real, locked unit with a checkpoint.
    expect(screen.getByTestId('home-node-unit-6').props.accessibilityLabel).toBe(
      'Unit 6, Capture Go · 吃子棋 chīzǐqí, locked',
    );
    expect(screen.getByTestId('home-node-checkpoint-6').props.accessibilityLabel).toBe(
      'Checkpoint, Capture Go games, locked',
    );
    expect(screen.getByText('More units coming soon')).toBeOnTheScreen();
    await fireEvent.press(card);
    expect(router.getPathname()).toBe('/lesson/u00-sample');
  });

  it('AC 99: 2★ on the sample → ★★☆, black dot; Continue moves on to Unit 1', async () => {
    act(() => {
      progressStore
        .getState()
        .record('u00-sample', ['clean', 'clean', 'clean', 'clean', 'solved', 'solved']);
    });
    await renderHome('en');
    expect(screen.getByTestId('home-node-unit-0').props.accessibilityLabel).toBe(
      'Sample (developer), Sample: Capture, 2 of 3 stars',
    );
    expect(screen.getByTestId('home-dot-done')).toBeTruthy();
    expect(screen.queryByTestId('home-all-done')).toBeNull();
    expect(screen.getByTestId('home-continue').props.accessibilityLabel).toMatch(/Unit 1/);
  });

  it('AC 101: tapping the sample opens its lesson', async () => {
    const router = await renderHome('en');
    await fireEvent.press(screen.getByTestId('home-node-unit-0'));
    expect(router.getPathname()).toBe('/lesson/u00-sample');
  });

  it('AC 102: a coming-soon node is not a button', async () => {
    // Since M5 item 4 the real catalog plans nothing: add a planned unit by hand.
    await act(() => setLanguageChoice('en'));
    const units = [
      ...getUnits({ includeDev: true }),
      { unit: 15, titleKey: 'unit.14.title', lesson: null, checkpoint: null },
    ];
    const planned = render(
      <UnitPath rows={mapRows(units, {})} hydrated onOpen={jest.fn()} onLocked={jest.fn()} />,
    );
    const soon = planned.getByTestId('home-node-unit-15');
    expect(soon.props.accessibilityRole).toBeUndefined();
    expect(soon.props.onClick ?? soon.props.onPress).toBeUndefined();
    expect(planned.getByText('Coming soon')).toBeOnTheScreen();
    planned.unmount();

    await renderHome('en');
    expect(screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
      'Open settings',
      'Start learning, Sample (developer)',
      'Sample (developer), Sample: Capture, not started',
      'Unit 1, Board & stones · 棋盘 qípán, not started',
      'Unit 2, Liberties · 气 qì, locked',
      'Unit 3, Connection · 连接 liánjiē, locked',
      'Unit 4, Capture · 提子 tízǐ, locked',
      'Unit 5, Atari & escape · 叫吃 jiàochī, locked',
      'Checkpoint, Review, locked',
      'Unit 6, Capture Go · 吃子棋 chīzǐqí, locked',
      'Checkpoint, Capture Go games, locked',
      'Unit 7, Forbidden points · 禁入点 jìnrùdiǎn, locked',
      'Unit 8, Ko · 打劫 dǎjié, locked',
      'Unit 9, Ladder · 征子 zhēngzi, locked',
      'Checkpoint, Review 2, locked',
      'Unit 10, Eyes · 眼 yǎn, locked',
      'Unit 11, Life and death · 死活 sǐhuó, locked',
      'Unit 11, The vital point, locked',
      'Checkpoint, Review 3, locked',
      'Unit 12, Territory · 地 dì, locked',
      'Unit 13, Counting · 数子 shùzǐ, locked',
      'Unit 14, End of game · 终局 zhōngjú, locked',
      'Checkpoint, Review 4, locked',
    ]);
  });

  it('AC 106: gear 44×44, Continue ≥ 56, node cards at least 72 high (M4 §5: they may grow)', async () => {
    await renderHome('zh-CN');
    const gear = StyleSheet.flatten(screen.getByRole('button', { name: '打开设置' }).props.style);
    expect(gear.width).toBeGreaterThanOrEqual(44);
    expect(gear.height).toBeGreaterThanOrEqual(44);
    const cont = StyleSheet.flatten(screen.getByTestId('home-continue').props.style);
    expect(cont.minHeight).toBeGreaterThanOrEqual(56);
    for (let n = 0; n <= 6; n++) {
      expect(
        StyleSheet.flatten(screen.getByTestId(`home-node-unit-${n}`).props.style).minHeight,
      ).toBe(72);
    }
  });
});

describe('release build (AC 98)', () => {
  // Updated by M5 item 4: no unit is "coming soon" any more (M5-territory-counting AC 2).
  it('no sample node; Start learning → Unit 1 (M4 AC 14); no unit coming soon', async () => {
    const original = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    try {
      const router = await renderHome('en');
      expect(screen.queryByTestId('home-node-unit-0')).toBeNull();
      expect(screen.queryByTestId('home-all-done')).toBeNull();
      expect(screen.queryAllByText('Coming soon')).toHaveLength(0);
      expect(screen.getByTestId('home-node-unit-10')).toBeOnTheScreen();
      expect(screen.getByText('More units coming soon')).toBeOnTheScreen();
      const card = screen.getByTestId('home-continue');
      expect(card.props.accessibilityLabel).toBe(
        'Start learning, Unit 1 · Board & stones · 棋盘 qípán',
      );
      await fireEvent.press(card);
      expect(router.getPathname()).toBe('/lesson/u01-board');
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = original;
    }
  });
});

describe('loading skeleton (AC 105)', () => {
  it('shows 72 px skeleton bars until progress is read, then the nodes', () => {
    const rows = mapRows(getUnits({ includeDev: true }), {});
    const view = render(
      <UnitPath rows={rows} hydrated={false} onOpen={jest.fn()} onLocked={jest.fn()} />,
    );
    const skeletons = screen.getAllByTestId('home-skeleton');
    expect(skeletons).toHaveLength(rows.length);
    for (const s of skeletons) expect(StyleSheet.flatten(s.props.style).height).toBe(72);
    expect(screen.queryByTestId('home-dot-locked')).toBeNull();
    expect(screen.queryByTestId('home-dot-available')).toBeNull();
    view.rerender(<UnitPath rows={rows} hydrated onOpen={jest.fn()} onLocked={jest.fn()} />);
    expect(screen.queryAllByTestId('home-skeleton')).toHaveLength(0);
    expect(StyleSheet.flatten(screen.getByTestId('home-node-unit-0').props.style).minHeight).toBe(
      72,
    );
  });
});

describe('announcements', () => {
  it('does not announce anything on a plain home render', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
    await renderHome('en');
    expect(announce).not.toHaveBeenCalled();
  });
});
