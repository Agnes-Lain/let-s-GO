import { getLocales } from 'expo-localization';

import en from './en.json';
import fr from './fr.json';
import i18n, {
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
    expect(fr['placeholder.comingSoon']).toMatch(/ !$/);
    expect(fr['placeholder.comingSoon']).not.toMatch(/ !/);
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
