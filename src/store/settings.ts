// Settings store (docs/specs/M6-settings-onboarding-a11y.md §3, AC 1–6): language, stone sound and
// reduce motion, saved under their own key through the same StorageAdapter as progress.
import { createStore, type StoreApi } from 'zustand/vanilla';

import type { StorageAdapter } from './storage';

export const SETTINGS_KEY = 'settings';
export const SETTINGS_VERSION = 1;

/** What the learner picked: follow the device, or a fixed UI language. */
export type LanguageSetting = 'system' | 'zh-CN' | 'en' | 'fr';

const LANGUAGE_SETTINGS: readonly LanguageSetting[] = ['system', 'zh-CN', 'en', 'fr'];

export interface Settings {
  language: LanguageSetting;
  /** Stone "tock" on/off. */
  sound: boolean;
  /** The app's own reduce-motion switch; added to the phone setting (effective = OS OR app). */
  reduceMotion: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  language: 'system',
  sound: true,
  reduceMotion: false,
});

export interface SettingsState extends Settings {
  /** False until the storage has been read. */
  hydrated: boolean;
  setLanguage(language: LanguageSetting): void;
  setSound(on: boolean): void;
  setReduceMotion(on: boolean): void;
}

export type SettingsStore = StoreApi<SettingsState>;

/** Saved settings; each missing or broken field falls back to its default (AC 3). */
export function parseSettings(raw: string | null): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (raw === null) return out;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return out;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return out;
  const { v, language, sound, reduceMotion } = data as Record<string, unknown>;
  if (v !== SETTINGS_VERSION) return out;
  if (LANGUAGE_SETTINGS.includes(language as LanguageSetting)) {
    out.language = language as LanguageSetting;
  }
  if (typeof sound === 'boolean') out.sound = sound;
  if (typeof reduceMotion === 'boolean') out.reduceMotion = reduceMotion;
  return out;
}

export function serializeSettings({ language, sound, reduceMotion }: Settings): string {
  return JSON.stringify({ v: SETTINGS_VERSION, language, sound, reduceMotion });
}

function ignoreRejection(result: void | Promise<void>): void {
  if (result instanceof Promise) result.catch(() => undefined);
}

export function createSettingsStore({ storage }: { storage: StorageAdapter }): SettingsStore {
  /** Fields the learner changed before the storage was read: they win over the stored value. */
  const touched = new Set<keyof Settings>();

  const save = () => {
    try {
      ignoreRejection(storage.setItem(SETTINGS_KEY, serializeSettings(store.getState())));
    } catch {
      // ignore: the setting still applies for this session
    }
  };

  const change = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (!store.getState().hydrated) touched.add(key);
    if (store.getState()[key] === value) return;
    store.setState({ [key]: value } as Partial<SettingsState>);
    save();
  };

  const store: SettingsStore = createStore<SettingsState>()(() => ({
    ...DEFAULT_SETTINGS,
    hydrated: false,
    setLanguage: (language) => change('language', language),
    setSound: (on) => change('sound', on),
    setReduceMotion: (on) => change('reduceMotion', on),
  }));

  const hydrate = (raw: string | null) => {
    const stored = parseSettings(raw);
    const current = store.getState();
    const next: Settings = {
      language: touched.has('language') ? current.language : stored.language,
      sound: touched.has('sound') ? current.sound : stored.sound,
      reduceMotion: touched.has('reduceMotion') ? current.reduceMotion : stored.reduceMotion,
    };
    store.setState({ ...next, hydrated: true });
    if (touched.size > 0) save();
  };

  let raw: string | null | Promise<string | null>;
  try {
    raw = storage.getItem(SETTINGS_KEY);
  } catch {
    raw = null;
  }
  if (raw instanceof Promise) {
    raw.then(hydrate, () => hydrate(null));
  } else {
    hydrate(raw);
  }
  return store;
}
