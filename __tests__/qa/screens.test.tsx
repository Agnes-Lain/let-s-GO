/**
 * QA (M0): extra screen checks — language round trips in all three languages, deep-link back
 * behaviour, not-found variants, tap targets on every screen, and decorative landscape placement.
 */
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { StyleSheet } from 'react-native';

import i18n, { setLanguageChoice, type Language } from '@/i18n';

// Device locale: Canadian French, so "use device language" is distinguishable from zh-CN and en.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'fr-CA', languageCode: 'fr' }],
}));

beforeEach(async () => {
  await act(() => setLanguageChoice('system'));
});

function selectedLabels() {
  return screen
    .getAllByRole('button')
    .filter((b) => b.props.accessibilityState?.selected === true)
    .map((b) => b.props.accessibilityLabel);
}

function expectTapTargets() {
  const buttons = screen.getAllByRole('button');
  expect(buttons.length).toBeGreaterThan(0);
  for (const button of buttons) {
    expect(typeof button.props.accessibilityLabel).toBe('string');
    expect(button.props.accessibilityLabel.length).toBeGreaterThan(0);
    const style = StyleSheet.flatten(button.props.style);
    const height = style.height ?? style.minHeight ?? 0;
    expect({ label: button.props.accessibilityLabel, height }).toEqual({
      label: button.props.accessibilityLabel,
      height: expect.any(Number),
    });
    expect(height).toBeGreaterThanOrEqual(44);
    if (style.width !== undefined || style.minWidth !== undefined) {
      expect(style.width ?? style.minWidth).toBeGreaterThanOrEqual(44);
    }
  }
}

describe('Settings language round trip (AC23–AC25)', () => {
  it('starts on the device language (fr-CA → French) with only "device language" checked', async () => {
    await renderRouter('./app', { initialUrl: '/settings' });
    expect(i18n.language).toBe('fr');
    expect(screen.getByText('Réglages')).toBeOnTheScreen();
    expect(selectedLabels()).toEqual(["Langue de l'appareil"]);
    expect(screen.getByText('Version 0.1.0')).toBeOnTheScreen();
  });

  it('zh-CN → English → Français → device language, exactly one check mark each time', async () => {
    const router = await renderRouter('./app', { initialUrl: '/' });
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvrir les réglages' }));
    expect(router.getPathname()).toBe('/settings');

    await fireEvent.press(screen.getByRole('button', { name: '中文（简体）' }));
    expect(screen.getByText('设置')).toBeOnTheScreen();
    expect(screen.getByText('版本 0.1.0')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '返回' })).toBeOnTheScreen();
    expect(selectedLabels()).toEqual(['中文（简体）']);

    await fireEvent.press(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByText('Settings')).toBeOnTheScreen();
    expect(screen.queryByText('设置')).not.toBeOnTheScreen();
    expect(selectedLabels()).toEqual(['English']);

    await fireEvent.press(screen.getByRole('button', { name: 'Français' }));
    expect(screen.getByText('Réglages')).toBeOnTheScreen();
    expect(selectedLabels()).toEqual(['Français']);

    await fireEvent.press(screen.getByRole('button', { name: "Langue de l'appareil" }));
    expect(i18n.language).toBe('fr');
    expect(selectedLabels()).toEqual(["Langue de l'appareil"]);

    // Language names never change with the UI language.
    for (const name of ['中文（简体）', 'English', 'Français']) {
      expect(screen.getByRole('button', { name })).toBeOnTheScreen();
    }
  });

  it('switching to zh-CN then back shows every Home text in Chinese', async () => {
    const router = await renderRouter('./app', { initialUrl: '/' });
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvrir les réglages' }));
    await fireEvent.press(screen.getByRole('button', { name: '中文（简体）' }));
    await fireEvent.press(screen.getByRole('button', { name: '返回' }));
    expect(router.getPathname()).toBe('/');
    for (const text of [
      "Let's GO",
      '从零开始，一步一步学会下围棋',
      '学习路线',
      '棋盘与棋子',
      '即将开放',
      '更多单元即将上线',
    ]) {
      // Several nodes share the badge text, so any match will do.
      expect(screen.getAllByText(text)[0]).toBeOnTheScreen();
    }
    expect(screen.getByRole('button', { name: '打开设置' })).toBeOnTheScreen();
  });

  it('Home in French shows every French text', async () => {
    await renderRouter('./app', { initialUrl: '/' });
    for (const text of [
      "Let's GO",
      'Apprenez le go (围棋 wéiqí) à partir de zéro, une règle à la fois',
      "Parcours d'apprentissage",
      'Plateau et pierres · 棋盘 qípán',
      'Bientôt disponible',
      "D'autres unités arrivent bientôt",
    ]) {
      // Several nodes share the badge text, so any match will do.
      expect(screen.getAllByText(text)[0]).toBeOnTheScreen();
    }
  });
});

describe('deep links and back (AC20–AC22)', () => {
  it('/settings opened directly: back goes to Home', async () => {
    const router = await renderRouter('./app', { initialUrl: '/settings' });
    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    expect(router.getPathname()).toBe('/');
    expect(screen.getByText("Parcours d'apprentissage")).toBeOnTheScreen();
  });

  it('Home → Settings → back returns to Home', async () => {
    const router = await renderRouter('./app', { initialUrl: '/' });
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvrir les réglages' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    expect(router.getPathname()).toBe('/');
  });

  it('a lesson that does not exist shows the French error screen (M3 AC 55)', async () => {
    await renderRouter('./app', { initialUrl: '/lesson/u99-missing' });
    expect(screen.getByText("Cette leçon ne s'ouvre pas")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retour à la carte' })).toBeOnTheScreen();
  });

  it('practice for an unknown lesson shows the French error screen', async () => {
    await renderRouter('./app', { initialUrl: '/practice/u02-liberties' });
    expect(screen.getByText("Cette leçon ne s'ouvre pas")).toBeOnTheScreen();
  });

  it.each(['/nope', '/nope/deeper', '/lesson/u01-board/extra', '/settings/x'])(
    '%s shows not-found with a working "home" button',
    async (url) => {
      const router = await renderRouter('./app', { initialUrl: url });
      expect(screen.getByText('Page introuvable')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: "Retour à l'accueil" }));
      expect(router.getPathname()).toBe('/');
    },
  );
});

describe('tap targets ≥ 44 and i18n labels on every screen (AC19, rule 7)', () => {
  it.each(['/', '/settings', '/lesson/u01-board', '/practice/abc', '/nope'])('%s', async (url) => {
    await renderRouter('./app', { initialUrl: url });
    expectTapTargets();
  });

  it.each(['zh-CN', 'en'] as Language[])('Settings rows are ≥ 44 high in %s too', async (lang) => {
    await act(() => setLanguageChoice(lang));
    await renderRouter('./app', { initialUrl: '/settings' });
    expectTapTargets();
  });
});

describe('decorative landscape (spec §6)', () => {
  it('Home has mist + mountains', async () => {
    await renderRouter('./app', { initialUrl: '/' });
    expect(screen.getByTestId('landscape-home', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('landscape-mist', { includeHiddenElements: true })).toBeNull();
  });

  it.each(['/settings', '/lesson/u01-board', '/practice/abc', '/nope'])(
    '%s has the thin mist only (no mountains)',
    async (url) => {
      await renderRouter('./app', { initialUrl: url });
      const mist = screen.getByTestId('landscape-mist', { includeHiddenElements: true });
      expect(mist.props.pointerEvents).toBe('none');
      expect(mist.props.accessible).toBe(false);
      expect(screen.queryByTestId('landscape-home', { includeHiddenElements: true })).toBeNull();
    },
  );
});

describe('no hard-coded user-facing strings in shared UI (AC8, rule 5)', () => {
  const root = join(__dirname, '..', '..');
  function tsx(dir: string): string[] {
    return readdirSync(join(root, dir)).flatMap((name) => {
      const path = join(dir, name);
      return statSync(join(root, path)).isDirectory()
        ? tsx(path)
        : path.endsWith('.tsx') && !path.includes('.test.')
          ? [path]
          : [];
    });
  }
  const files = [...tsx('app'), ...tsx('src/theme')];

  it.each(files)('%s: no string-literal labels, titles or hints', (file) => {
    // Comments may contain Chinese (e.g. the 山水 mood); only code is checked.
    const source = readFileSync(join(root, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(source).not.toMatch(
      /(accessibilityLabel|accessibilityHint|aria-label|title|label|body|placeholder)=["'][^"']*[A-Za-z一-鿿]/,
    );
    expect(source).not.toMatch(/[一-鿿　-〿＀-￯]/);
  });

  it.each(files)('%s: no literal JSX text', (file) => {
    const literalText =
      readFileSync(join(root, file), 'utf8').match(/>\s*[^\s<>{}()=;,][^<>{}]*</g) ?? [];
    expect(literalText).toEqual([]);
  });
});
