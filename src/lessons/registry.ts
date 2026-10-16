// Every lesson file shipped with the app. Metro bundles only static imports, so a new lesson is
// one import line plus one entry below. The i18n JSON files are imported as plain data so the
// loader can check that every text key exists (no React / i18next here).
import en from '@/i18n/en.json';
import fr from '@/i18n/fr.json';
import zhCN from '@/i18n/zh-CN.json';

import u00Sample from './content/u00-sample.json';
import type { Language } from './schema';

export const LESSON_FILES: readonly unknown[] = [u00Sample];

export const LESSON_TEXTS: Readonly<Record<Language, Readonly<Record<string, string>>>> = {
  'zh-CN': zhCN,
  en,
  fr,
};
