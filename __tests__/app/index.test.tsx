import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';

import { setLanguageChoice, type Language } from '@/i18n';

// Device locale: Simplified Chinese (the primary language).
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'zh-Hans-CN', languageCode: 'zh' }],
}));

async function renderHome(language: Language) {
  await act(() => setLanguageChoice(language));
  return renderRouter('./app', { initialUrl: '/' });
}

afterEach(async () => {
  await act(() => setLanguageChoice('system'));
});

describe('Home screen', () => {
  it('shows the zh-CN home content (AC15)', async () => {
    const router = await renderHome('zh-CN');
    expect(router.getPathname()).toBe('/');
    expect(screen.getByText("Let's GO")).toBeOnTheScreen();
    expect(screen.getByText('从零开始，一步一步学会下围棋')).toBeOnTheScreen();
    expect(screen.getByText('学习路线')).toBeOnTheScreen();
    expect(screen.getByText('第 1 单元 · 棋盘与棋子')).toBeOnTheScreen();
    expect(screen.getByText('即将开放')).toBeOnTheScreen();
    expect(screen.getByText('更多单元即将上线')).toBeOnTheScreen();
  });

  it('shows the English home content (AC16)', async () => {
    await renderHome('en');
    expect(screen.getByText("Let's GO")).toBeOnTheScreen();
    expect(
      screen.getByText('Learn Go (围棋 wéiqí) from zero, one rule at a time'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Learning path')).toBeOnTheScreen();
    expect(screen.getByText('Unit 1 · Board & stones')).toBeOnTheScreen();
    expect(screen.getByText('Coming soon')).toBeOnTheScreen();
  });

  it('shows the French home content (AC16)', async () => {
    await renderHome('fr');
    expect(screen.getByText("Let's GO")).toBeOnTheScreen();
    expect(screen.getByText("Parcours d'apprentissage")).toBeOnTheScreen();
    expect(screen.getByText('Unité 1 · Le goban et les pierres')).toBeOnTheScreen();
    expect(screen.getByText('Bientôt disponible')).toBeOnTheScreen();
  });

  it('opens the first lesson when the Unit 1 card is tapped (AC17)', async () => {
    const router = await renderHome('zh-CN');
    await fireEvent.press(screen.getByRole('button', { name: '第 1 单元 · 棋盘与棋子' }));
    expect(router.getPathname()).toBe('/lesson/u01-board');
  });

  it('opens Settings from the gear button (AC18)', async () => {
    const router = await renderHome('en');
    await fireEvent.press(screen.getByRole('button', { name: 'Open settings' }));
    expect(router.getPathname()).toBe('/settings');
  });

  it('gives every pressable a button role, an i18n label and a 44×44 hit area (AC19)', async () => {
    await renderHome('zh-CN');
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.props.accessibilityLabel)).toEqual([
      '打开设置',
      '第 1 单元 · 棋盘与棋子',
    ]);
    for (const button of buttons) {
      const style = StyleSheet.flatten(button.props.style);
      const width = style.width ?? style.minWidth ?? 0;
      const height = style.height ?? style.minHeight ?? 0;
      // The card stretches to the content width (328px at 360px), so only its height is fixed.
      expect(height).toBeGreaterThanOrEqual(44);
      if (style.width !== undefined || style.minWidth !== undefined) {
        expect(width).toBeGreaterThanOrEqual(44);
      }
    }
  });

  it('draws the decorative landscape hidden from accessibility and touches', async () => {
    await renderHome('zh-CN');
    const landscape = screen.getByTestId('landscape-home', { includeHiddenElements: true });
    expect(landscape.props.accessible).toBe(false);
    expect(landscape.props.pointerEvents).toBe('none');
  });
});
