// App stores (Zustand). Progress and settings are saved on the phone through a storage adapter
// (spec §11 Q1; M6-settings §3).
import { useStore } from 'zustand';

import { bindLanguageSettings } from '@/i18n';
import { getUnits } from '@/lessons';

import { appStorageAdapter } from './asyncStorage';
import { createProgressStore, type ProgressState } from './progress';
import { createSettingsStore, type SettingsState } from './settings';

export * from './progress';
export * from './settings';
export * from './onboarding';
export { createMemoryStorage, type StorageAdapter } from './storage';

/** The app's progress store, read from the phone storage at start-up. */
export const progressStore = createProgressStore({
  storage: appStorageAdapter,
  units: () => getUnits(),
});

/** The app's settings store (language, sound, reduce motion), read from the phone storage at start-up. */
export const settingsStore = createSettingsStore({ storage: appStorageAdapter });

// The saved language drives i18n from the first hydrated frame (AC 4, 8).
bindLanguageSettings(settingsStore);

/** React hook over the progress store: `useProgress((s) => s.lessons)`. */
export function useProgress<T>(selector: (state: ProgressState) => T): T {
  return useStore(progressStore, selector);
}

/** React hook over the settings store: `useSettings((s) => s.sound)`. */
export function useSettings<T>(selector: (state: SettingsState) => T): T {
  return useStore(settingsStore, selector);
}
