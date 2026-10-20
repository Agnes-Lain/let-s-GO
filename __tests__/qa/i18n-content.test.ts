/**
 * QA (M0): extra i18n checks beyond src/i18n/i18n.test.ts — French typography, key usage
 * from code, resolveLanguage edge cases, and the copy table in docs/specs/M0-project-setup.md §4.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import en from '@/i18n/en.json';
import fr from '@/i18n/fr.json';
import zhCN from '@/i18n/zh-CN.json';
import { resolveLanguage } from '@/i18n';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'zh-Hans-CN', languageCode: 'zh' }],
}));

const root = join(__dirname, '..', '..');
const files: Record<string, Record<string, string>> = { 'zh-CN': zhCN, en, fr };

function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(root, path)).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('French typography', () => {
  it.each(Object.entries(fr))(
    '%s: "! ? : ;" are preceded by a non-breaking space',
    (_key, value) => {
      for (let i = 0; i < value.length; i++) {
        if ('!?:;'.includes(value[i])) {
          expect({ value, before: value[i - 1] }).toEqual({
            value,
            before: expect.stringMatching(/[  ]/),
          });
        }
      }
    },
  );

  it('uses no plain space directly before "! ? : ;" anywhere', () => {
    for (const value of Object.values(fr)) {
      expect(value).not.toMatch(/ [!?:;]/);
    }
  });

  it('English uses no space before "!" or "?"', () => {
    for (const value of Object.values(en)) {
      expect(value).not.toMatch(/\s[!?]/);
    }
  });
});

describe('copy table §4 is implemented verbatim', () => {
  // Spot-check the strings that are most likely to drift.
  it.each([
    ['zh-CN', 'home.subtitle', '从零开始，一步一步学会下围棋'],
    ['en', 'home.subtitle', 'Learn Go (围棋 wéiqí) from zero, one rule at a time'],
    ['fr', 'home.subtitle', 'Apprenez le go (围棋 wéiqí) à partir de zéro, une règle à la fois'],
    ['fr', 'settings.open', 'Ouvrir les réglages'],
    ['fr', 'notFound.title', 'Page introuvable'],
    ['fr', 'notFound.home', "Retour à l'accueil"],
    ['zh-CN', 'notFound.title', '找不到这个页面'],
    ['zh-CN', 'notFound.home', '回到首页'],
    ['zh-CN', 'settings.language.system', '跟随系统'],
    ['en', 'settings.language.system', 'Use device language'],
    ['fr', 'settings.language.system', "Langue de l'appareil"],
  ])('%s %s', (language, key, expected) => {
    expect(files[language][key]).toBe(expected);
  });

  it('has exactly the 20 keys of the spec (M2 board/engine/dev keys are counted separately)', () => {
    // M3 keys (spec docs/specs/M3-lesson-framework.md §7) are counted by the M3 tests; the M4
    // Capture Go keys (game.*, docs/specs/M4-bot-capture-go.md §11) by src/exercises tests.
    const m3Home =
      /^home\.(continue|start|unit\.label|checkpoint\.label|sample\.label|locked\.hint|node\.a11y\..+|allDone)$/;
    const m0Keys = Object.keys(zhCN).filter(
      (key) =>
        // sequence.*: the M5 sequence runner (docs/specs/M5-life-death.md §5.4).
        !/^(engine|board|dev|unit|lesson|error|complete|practice|fb|game|sequence)\./.test(key) &&
        !m3Home.test(key),
    );
    // M3 removed the placeholder keys its screens replaced (spec M3 §7.1).
    const removedByM3 = [
      'placeholder.lesson.title',
      'placeholder.practice.title',
      'placeholder.comingSoon',
      'home.unit1.title',
    ];
    removedByM3.forEach((key) => expect(m0Keys).not.toContain(key));
    expect(m0Keys).toHaveLength(20 - removedByM3.length);
  });
});

describe('every key used in code exists in all languages (and none are orphaned)', () => {
  const sources = [...sourceFiles('app'), ...sourceFiles('src')]
    .map((file) => readFileSync(join(root, file), 'utf8'))
    .join('\n');
  // t('key') calls, `labelKey: 'key'` entries (Settings language list) and `key: 'key'` feedback
  // lines / key maps (M3 exercises).
  const usedKeys = new Set(
    [
      ...sources.matchAll(
        /\bt\(\s*'([^']+)'|labelKey:\s*'([^']+)'|\bkey:\s*'([^']+)'|:\s*'(engine\.illegal\.[^']+)'/g,
      ),
    ].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4]),
  );

  // t(`prefix.${x}`) calls and key templates such as `unit.${n}.title`: every key under that
  // prefix counts as used.
  const dynamicPrefixes = [
    ...sources.matchAll(/\bt\(\s*`([^`$]+)\$\{/g),
    ...sources.matchAll(/`([a-z][\w-]*\.)\$\{/g),
  ].map((m) => m[1]);

  // Lesson JSON files reference their texts by key (`titleKey`, `promptKey`, …).
  const lessonDir = join(root, 'src/lessons/content');
  for (const file of readdirSync(lessonDir).filter((f) => f.endsWith('.json'))) {
    const json = readFileSync(join(lessonDir, file), 'utf8');
    for (const m of json.matchAll(/"\w+Key":\s*"([^"]+)"/g)) usedKeys.add(m[1]);
  }

  it('finds the keys used by the screens', () => {
    expect(usedKeys.size).toBeGreaterThan(10);
  });

  it.each(Object.keys(files))('%s defines every key used in code', (language) => {
    for (const key of usedKeys) {
      const defined = key in files[language] || `${key}_other` in files[language];
      expect({ key, defined }).toEqual({ key, defined: true });
    }
  });

  it('every translation key is used somewhere in code', () => {
    for (const key of Object.keys(zhCN)) {
      // i18next plural forms (`x_one`, `x_other`) are used through their base key `x` (M5 AC 34).
      const base = key.replace(/_(one|other)$/, '');
      const used =
        usedKeys.has(key) ||
        usedKeys.has(base) ||
        dynamicPrefixes.some((prefix) => key.startsWith(prefix));
      expect({ key, used }).toEqual({ key, used: true });
    }
  });
});

describe('resolveLanguage edge cases (AC10–12, AC14)', () => {
  it.each([
    ['ZH', 'zh-CN'],
    ['Zh-Hant', 'zh-CN'],
    ['zh_TW', 'zh-CN'],
    ['zh_CN', 'zh-CN'],
    ['  zh  ', 'zh-CN'],
    ['FR', 'fr'],
    ['fr_CA', 'fr'],
    ['fr-CH', 'fr'],
    [' fr-CA ', 'fr'],
    ['EN', 'en'],
    ['en_AU', 'en'],
    ['pt-BR', 'en'],
    ['pt', 'en'],
    ['ja-JP', 'en'],
    ['ko', 'en'],
    ['es-419', 'en'],
    ['   ', 'en'],
    ['', 'en'],
  ])('%j → %s', (code, expected) => {
    expect(resolveLanguage(code)).toBe(expected);
  });

  it('undefined → en (getLocales() may return a locale without languageCode)', () => {
    expect(resolveLanguage(undefined as unknown as string | null)).toBe('en');
  });

  it('null → en', () => {
    expect(resolveLanguage(null)).toBe('en');
  });
});
