import { getLocales } from 'expo-localization';

import en from './en.json';
import fr from './fr.json';
import i18n, {
  bindLanguageSettings,
  getDeviceLanguage,
  getLanguageChoice,
  resolveLanguage,
  setLanguageChoice,
} from './index';
import zhCN from './zh-CN.json';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageTag: 'zh-Hans-CN', languageCode: 'zh' }]),
}));

const mockedGetLocales = getLocales as jest.Mock;

function mockDeviceLocales(locales: { languageTag: string; languageCode: string | null }[]) {
  mockedGetLocales.mockReturnValue(locales);
}

describe('translation files (AC9)', () => {
  const files: Record<string, Record<string, string>> = { 'zh-CN': zhCN, en, fr };
  const zhKeys = Object.keys(zhCN).sort();

  it.each(Object.keys(files))('%s has the same keys as zh-CN', (language) => {
    expect(Object.keys(files[language]).sort()).toEqual(zhKeys);
  });

  it.each(Object.keys(files))('%s has only non-empty string values', (language) => {
    for (const [key, value] of Object.entries(files[language])) {
      expect({ key, type: typeof value }).toEqual({ key, type: 'string' });
      expect({ key, empty: value.trim().length === 0 }).toEqual({ key, empty: false });
    }
  });

  it('French uses a non-breaking space before "!"', () => {
    expect(fr['fb.correct']).toMatch(/ !$/);
    expect(fr['fb.correct']).not.toMatch(/ !/);
  });

  it('language names are always written in their own language', () => {
    for (const file of Object.values(files)) {
      expect(file['settings.language.zh']).toBe('中文（简体）');
      expect(file['settings.language.en']).toBe('English');
      expect(file['settings.language.fr']).toBe('Français');
    }
  });
});

describe('resolveLanguage (AC10–12, AC14)', () => {
  it.each(['zh', 'ZH', 'zh-Hans-CN', 'zh-Hant-TW'])('%s → zh-CN', (code) => {
    expect(resolveLanguage(code)).toBe('zh-CN');
  });

  it.each(['en', 'en-US', 'en-GB'])('%s → en', (code) => {
    expect(resolveLanguage(code)).toBe('en');
  });

  it.each(['fr', 'fr-FR', 'fr-CA', 'fr-BE'])('%s → fr', (code) => {
    expect(resolveLanguage(code)).toBe('fr');
  });

  it.each(['de', 'de-DE', 'ja', 'es', ''])('%s → en (fallback)', (code) => {
    expect(resolveLanguage(code)).toBe('en');
  });

  it('null → en', () => {
    expect(resolveLanguage(null)).toBe('en');
  });
});

describe('device language detection (AC10–12)', () => {
  it.each([
    [[{ languageTag: 'zh-Hans-CN', languageCode: 'zh' }], 'zh-CN'],
    [[{ languageTag: 'zh-Hant-TW', languageCode: 'zh' }], 'zh-CN'],
    [[{ languageTag: 'en-US', languageCode: 'en' }], 'en'],
    [[{ languageTag: 'en-GB', languageCode: 'en' }], 'en'],
    [[{ languageTag: 'fr-FR', languageCode: 'fr' }], 'fr'],
    [[{ languageTag: 'fr-CA', languageCode: 'fr' }], 'fr'],
    [[{ languageTag: 'fr-BE', languageCode: 'fr' }], 'fr'],
    [[{ languageTag: 'de-DE', languageCode: 'de' }], 'en'],
    [[{ languageTag: 'und', languageCode: null }], 'en'],
    [[], 'en'],
  ])('getLocales() = %j → %s', (locales, expected) => {
    mockDeviceLocales(locales);
    expect(getDeviceLanguage()).toBe(expected);
  });

  it('initialises i18n with the device language at startup', () => {
    // The mock returned zh-Hans-CN when the module was first imported.
    expect(i18n.isInitialized).toBe(true);
    expect(getLanguageChoice()).toBe('system');
  });
});

describe('app name (AC13)', () => {
  it.each(['zh-CN', 'en', 'fr'] as const)('t("app.name") is "Let\'s GO" in %s', async (lang) => {
    await setLanguageChoice(lang);
    expect(i18n.language).toBe(lang);
    expect(i18n.t('app.name')).toBe("Let's GO");
  });
});

describe('setLanguageChoice (AC24, AC25)', () => {
  it('a fixed choice switches the language immediately', async () => {
    await setLanguageChoice('fr');
    expect(getLanguageChoice()).toBe('fr');
    expect(i18n.t('settings.title')).toBe('Réglages');
    await setLanguageChoice('en');
    expect(i18n.t('settings.title')).toBe('Settings');
  });

  it('"system" follows the device locale through resolveLanguage', async () => {
    mockDeviceLocales([{ languageTag: 'fr-CA', languageCode: 'fr' }]);
    await setLanguageChoice('zh-CN');
    await setLanguageChoice('system');
    expect(getLanguageChoice()).toBe('system');
    expect(i18n.language).toBe('fr');

    mockDeviceLocales([{ languageTag: 'de-DE', languageCode: 'de' }]);
    await setLanguageChoice('system');
    expect(i18n.language).toBe('en');
  });
});

describe('saved language (M6-settings AC 4, 5)', () => {
  // Required lazily so this file keeps testing the i18n module on its own.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { createSettingsStore, SETTINGS_KEY } =
    require('@/store/settings') as typeof import('@/store/settings');
  const { createMemoryStorage } = require('@/store/storage') as typeof import('@/store/storage');
  /* eslint-enable @typescript-eslint/no-require-imports */

  it.each(['fr', 'zh-CN', 'en'] as const)(
    'AC 4: setLanguageChoice(%s) applies at once, is saved, and a restart resolves it',
    async (choice) => {
      mockDeviceLocales([{ languageTag: 'de-DE', languageCode: 'de' }]);
      const storage = createMemoryStorage();
      const unbind = bindLanguageSettings(createSettingsStore({ storage }));
      await setLanguageChoice(choice);
      expect(i18n.language).toBe(choice);
      expect(JSON.parse(storage.data.get(SETTINGS_KEY) as string).language).toBe(choice);
      unbind();

      // Simulated restart: a fresh i18n module and a fresh store over the same storage.
      let reloaded: typeof import('./index') | undefined;
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        reloaded = require('./index');
      });
      expect(reloaded?.default.language).toBe('en'); // device "de" before the store is read
      reloaded?.bindLanguageSettings(createSettingsStore({ storage }));
      expect(reloaded?.getLanguageChoice()).toBe(choice);
      expect(reloaded?.default.language).toBe(choice);
    },
  );

  it.each([
    ['de', 'en'],
    ['zh', 'zh-CN'],
  ])('AC 5: "system" with device %s → %s', async (code, expected) => {
    mockDeviceLocales([{ languageTag: code === 'zh' ? 'zh-Hans' : code, languageCode: code }]);
    const storage = createMemoryStorage({
      [SETTINGS_KEY]: JSON.stringify({
        v: 1,
        language: 'system',
        sound: true,
        reduceMotion: false,
      }),
    });
    await setLanguageChoice('fr');
    const unbind = bindLanguageSettings(createSettingsStore({ storage }));
    expect(getLanguageChoice()).toBe('system');
    expect(i18n.language).toBe(expected);
    unbind();
  });

  it('a store read later (async) switches the language when it hydrates', async () => {
    let resolve: (value: string | null) => void = () => undefined;
    const store = createSettingsStore({
      storage: {
        getItem: () => new Promise((r) => (resolve = r)),
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    });
    mockDeviceLocales([{ languageTag: 'en-US', languageCode: 'en' }]);
    const unbind = bindLanguageSettings(store);
    expect(i18n.language).toBe('en');
    resolve(JSON.stringify({ v: 1, language: 'fr', sound: true, reduceMotion: false }));
    await new Promise((r) => setTimeout(r, 0));
    expect(i18n.language).toBe('fr');
    expect(getLanguageChoice()).toBe('fr');
    unbind();
  });
});
