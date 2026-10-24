// Test-only copy of the old unit-0 developer sample (M6-settings AC 53). The app no longer ships it;
// screen tests that used it as a ready-made lesson mock the registry with it:
//
//   jest.mock('@/lessons/registry', () =>
//     jest.requireActual('@/lessons/__fixtures__/sampleRegistry').registryWithSample(),
//   );
//
// The mock also adds the sample's texts to the app's i18n instance, so screens show real text.
import type { Language } from '../schema';
import sample from './u00-sample.json';
import sampleTexts from './u00-sample.texts.json';

export const SAMPLE_ID = 'u00-sample';

/** The sample lesson file (raw JSON; tests spread it into their own test lessons). */
export const SAMPLE_LESSON = sample as Record<string, unknown>;

/** The sample's texts per language (`lesson.u00-sample.*`). */
export const SAMPLE_TEXTS = sampleTexts as Record<Language, Record<string, string>>;

/** A registry module: the sample first, then every app lesson; texts merged. */
export function registryWithSample(extraFiles: readonly unknown[] = []) {
  const actual = jest.requireActual<typeof import('../registry')>('../registry');
  const i18n = jest.requireActual<typeof import('@/i18n')>('@/i18n').default;
  const languages: Language[] = ['zh-CN', 'en', 'fr'];
  for (const lang of languages) {
    i18n.addResourceBundle(lang, 'translation', SAMPLE_TEXTS[lang], true, true);
  }
  const texts = Object.fromEntries(
    languages.map((lang) => [lang, { ...actual.LESSON_TEXTS[lang], ...SAMPLE_TEXTS[lang] }]),
  ) as Record<Language, Record<string, string>>;
  return {
    __esModule: true,
    LESSON_FILES: [sample, ...actual.LESSON_FILES, ...extraFiles],
    LESSON_TEXTS: texts,
  };
}
