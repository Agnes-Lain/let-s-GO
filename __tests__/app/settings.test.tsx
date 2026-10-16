import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import appConfig from '../../app.json';
import i18n, { getLanguageChoice, setLanguageChoice } from '@/i18n';

// Device locale: Simplified Chinese.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'zh-Hans-CN', languageCode: 'zh' }],
}));

beforeEach(async () => {
  await act(() => setLanguageChoice('system'));
});

function isSelected(name: string) {
  return screen.getByRole('button', { name }).props.accessibilityState?.selected === true;
}

describe('Settings', () => {
  it('lists four language options with "use device language" selected by default (AC23)', async () => {
    await renderRouter('./app', { initialUrl: '/settings' });
    expect(screen.getByText('设置')).toBeOnTheScreen();
    expect(screen.getByText('语言')).toBeOnTheScreen();
    for (const name of ['跟随系统', '中文（简体）', 'English', 'Français']) {
      expect(screen.getByRole('button', { name })).toBeOnTheScreen();
    }
    expect(isSelected('跟随系统')).toBe(true);
    expect(isSelected('中文（简体）')).toBe(false);
    expect(isSelected('English')).toBe(false);
    expect(isSelected('Français')).toBe(false);
  });

  it('switches to English immediately and Home follows (AC24)', async () => {
    const router = await renderRouter('./app', { initialUrl: '/' });
    await fireEvent.press(screen.getByRole('button', { name: '打开设置' }));
    expect(router.getPathname()).toBe('/settings');

    await fireEvent.press(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByText('Settings')).toBeOnTheScreen();
    expect(screen.getByText('Language')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Use device language' })).toBeOnTheScreen();
    expect(screen.queryByText('设置')).not.toBeOnTheScreen();
    expect(isSelected('English')).toBe(true);
    expect(isSelected('Use device language')).toBe(false);

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(router.getPathname()).toBe('/');
    expect(screen.getByText('Board & stones · 棋盘 qípán')).toBeOnTheScreen();
  });

  it('switches to French immediately and Home follows (AC24)', async () => {
    const router = await renderRouter('./app', { initialUrl: '/' });
    await fireEvent.press(screen.getByRole('button', { name: '打开设置' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Français' }));
    expect(screen.getByText('Réglages')).toBeOnTheScreen();
    expect(screen.getByText('Langue')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "Langue de l'appareil" })).toBeOnTheScreen();
    expect(isSelected('Français')).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    expect(router.getPathname()).toBe('/');
    expect(screen.getByText('Plateau et pierres · 棋盘 qípán')).toBeOnTheScreen();
  });

  it('"use device language" goes back to the device language (AC25)', async () => {
    await renderRouter('./app', { initialUrl: '/settings' });
    await fireEvent.press(screen.getByRole('button', { name: 'English' }));
    expect(i18n.language).toBe('en');

    await fireEvent.press(screen.getByRole('button', { name: 'Use device language' }));
    expect(i18n.language).toBe('zh-CN');
    expect(screen.getByText('设置')).toBeOnTheScreen();
    expect(isSelected('跟随系统')).toBe(true);
  });

  it('shows the app version from app.json (AC26)', async () => {
    expect(appConfig.expo.version).toBe('0.1.0');
    await renderRouter('./app', { initialUrl: '/settings' });
    expect(screen.getByText('版本 0.1.0')).toBeOnTheScreen();
  });

  it('does not persist the choice: a fresh start follows the device again (AC27)', async () => {
    await renderRouter('./app', { initialUrl: '/settings' });
    await fireEvent.press(screen.getByRole('button', { name: 'English' }));
    expect(getLanguageChoice()).toBe('en');

    // Simulate an app reload: a fresh module registry re-initialises i18n.
    let reloaded: typeof import('@/i18n') | undefined;
    jest.isolateModules(() => {
      // A synchronous require is the only way to load a fresh copy inside isolateModules.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      reloaded = require('@/i18n');
    });
    expect(reloaded?.getLanguageChoice()).toBe('system');
    expect(reloaded?.default.language).toBe('zh-CN');
  });
});
