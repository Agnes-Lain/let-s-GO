import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { useSyncExternalStore } from 'react';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import fr from './fr.json';
import zhCN from './zh-CN.json';

/** UI languages the app ships. zh-CN is the primary language. */
export type Language = 'zh-CN' | 'en' | 'fr';

/** What the learner picked in Settings: follow the device, or a fixed language. */
export type LanguageChoice = 'system' | Language;

export const LANGUAGES: readonly Language[] = ['zh-CN', 'en', 'fr'];

export const resources = {
  'zh-CN': { translation: zhCN },
  en: { translation: en },
  fr: { translation: fr },
} as const;

/**
 * Map a device language code (e.g. `zh`, `en`, `fr`, from expo-localization) to a UI language.
 * Any other or missing locale falls back to English (product decision D2).
 */
export function resolveLanguage(languageCode: string | null): Language {
  const code = languageCode?.trim().toLowerCase() ?? '';
  if (code.startsWith('zh')) return 'zh-CN';
  if (code.startsWith('fr')) return 'fr';
  return 'en';
}

/** The UI language that matches the device's first preferred locale. */
export function getDeviceLanguage(): Language {
  const [first] = getLocales();
  return resolveLanguage(first?.languageCode ?? null);
}

/** The app's single i18next instance. */
const i18n = createInstance();

// The choice is kept in memory only: M0 does not persist it (AC27).
let languageChoice: LanguageChoice = 'system';
const listeners = new Set<() => void>();

export function getLanguageChoice(): LanguageChoice {
  return languageChoice;
}

/** Apply a Settings choice immediately; screens re-render through react-i18next. */
export async function setLanguageChoice(choice: LanguageChoice): Promise<void> {
  languageChoice = choice;
  listeners.forEach((listener) => listener());
  await i18n.changeLanguage(choice === 'system' ? getDeviceLanguage() : choice);
}

function subscribeLanguageChoice(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React hook: the current Settings language choice. */
export function useLanguageChoice(): LanguageChoice {
  return useSyncExternalStore(subscribeLanguageChoice, getLanguageChoice, getLanguageChoice);
}

i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: 'en',
  supportedLngs: LANGUAGES as Language[],
  // Keys are flat strings such as `settings.language.system`, so dots are not nesting.
  keySeparator: false,
  interpolation: { escapeValue: false },
  initAsync: false,
});

export default i18n;
