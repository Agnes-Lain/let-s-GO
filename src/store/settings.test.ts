// Settings store (docs/specs/M6-settings-onboarding-a11y.md §4.1, AC 1–6).
import {
  createSettingsStore,
  DEFAULT_SETTINGS,
  parseSettings,
  SETTINGS_KEY,
  SETTINGS_VERSION,
} from './settings';
import { createMemoryStorage, type StorageAdapter } from './storage';

const saved = (storage: ReturnType<typeof createMemoryStorage>) =>
  JSON.parse(storage.data.get(SETTINGS_KEY) as string) as Record<string, unknown>;

describe('hydration (AC 1–3)', () => {
  it('AC 1: an empty storage loads the defaults and is hydrated', () => {
    const store = createSettingsStore({ storage: createMemoryStorage() });
    const { hydrated, language, sound, reduceMotion } = store.getState();
    expect({ hydrated, language, sound, reduceMotion }).toEqual({
      hydrated: true,
      language: 'system',
      sound: true,
      reduceMotion: false,
    });
    expect(DEFAULT_SETTINGS).toEqual({ language: 'system', sound: true, reduceMotion: false });
  });

  it('AC 2: saved values load', () => {
    const storage = createMemoryStorage({
      [SETTINGS_KEY]: JSON.stringify({ v: 1, language: 'fr', sound: false, reduceMotion: true }),
    });
    const { language, sound, reduceMotion } = createSettingsStore({ storage }).getState();
    expect({ language, sound, reduceMotion }).toEqual({
      language: 'fr',
      sound: false,
      reduceMotion: true,
    });
    expect(SETTINGS_VERSION).toBe(1);
  });

  it.each([
    ['not json', 'not json', DEFAULT_SETTINGS],
    ['another version', JSON.stringify({ v: 2, language: 'fr', sound: false }), DEFAULT_SETTINGS],
    ['an array', '[]', DEFAULT_SETTINGS],
    ['null', 'null', DEFAULT_SETTINGS],
    [
      'an unknown language',
      JSON.stringify({ v: 1, language: 'de', sound: false, reduceMotion: true }),
      { language: 'system', sound: false, reduceMotion: true },
    ],
    [
      'a string for sound',
      JSON.stringify({ v: 1, language: 'en', sound: 'yes', reduceMotion: true }),
      { language: 'en', sound: true, reduceMotion: true },
    ],
    [
      'a number for reduce motion',
      JSON.stringify({ v: 1, language: 'zh-CN', sound: false, reduceMotion: 1 }),
      { language: 'zh-CN', sound: false, reduceMotion: false },
    ],
  ])('AC 3: %s → bad fields fall back, valid ones kept, no throw', (_name, raw, expected) => {
    expect(parseSettings(raw)).toEqual(expected);
    const storage = createMemoryStorage({ [SETTINGS_KEY]: raw });
    let store: ReturnType<typeof createSettingsStore> | undefined;
    expect(() => {
      store = createSettingsStore({ storage });
    }).not.toThrow();
    const { language, sound, reduceMotion } = store!.getState();
    expect({ language, sound, reduceMotion }).toEqual(expected);
  });

  it('a throwing or rejecting adapter hydrates with the defaults', async () => {
    const throwing: StorageAdapter = {
      getItem: () => {
        throw new Error('boom');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(createSettingsStore({ storage: throwing }).getState().hydrated).toBe(true);
    const rejecting: StorageAdapter = {
      getItem: () => Promise.reject(new Error('nope')),
      setItem: () => Promise.reject(new Error('nope')),
      removeItem: () => undefined,
    };
    const store = createSettingsStore({ storage: rejecting });
    await new Promise((r) => setTimeout(r, 0));
    expect(store.getState().hydrated).toBe(true);
    expect(() => store.getState().setSound(false)).not.toThrow();
  });
});

describe('setters save (AC 4, 10)', () => {
  it('each setter writes the whole value with the version', () => {
    const storage = createMemoryStorage();
    const store = createSettingsStore({ storage });
    store.getState().setLanguage('fr');
    expect(saved(storage)).toEqual({ v: 1, language: 'fr', sound: true, reduceMotion: false });
    store.getState().setSound(false);
    store.getState().setReduceMotion(true);
    expect(saved(storage)).toEqual({ v: 1, language: 'fr', sound: false, reduceMotion: true });
    // A restart over the same storage reads them back.
    const { language, sound, reduceMotion } = createSettingsStore({ storage }).getState();
    expect({ language, sound, reduceMotion }).toEqual({
      language: 'fr',
      sound: false,
      reduceMotion: true,
    });
  });
});

describe('before hydration (AC 6)', () => {
  it('a change made before the read finished wins and is saved', async () => {
    let resolve: (value: string | null) => void = () => undefined;
    const writes: string[] = [];
    const storage: StorageAdapter = {
      getItem: () => new Promise((r) => (resolve = r)),
      setItem: (_key, value) => {
        writes.push(value);
      },
      removeItem: () => undefined,
    };
    const store = createSettingsStore({ storage });
    expect(store.getState().hydrated).toBe(false);
    store.getState().setLanguage('en');
    resolve(JSON.stringify({ v: 1, language: 'fr', sound: false, reduceMotion: true }));
    await new Promise((r) => setTimeout(r, 0));
    const { hydrated, language, sound, reduceMotion } = store.getState();
    // The learner's choice wins; the untouched fields come from storage.
    expect({ hydrated, language, sound, reduceMotion }).toEqual({
      hydrated: true,
      language: 'en',
      sound: false,
      reduceMotion: true,
    });
    expect(JSON.parse(writes[writes.length - 1])).toEqual({
      v: 1,
      language: 'en',
      sound: false,
      reduceMotion: true,
    });
  });
});

describe('purity', () => {
  it('the store file imports no native module', () => {
    const { readFileSync } = jest.requireActual<typeof import('node:fs')>('node:fs');
    const code = readFileSync(require.resolve('./settings'), 'utf8');
    const imports = [...code.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    expect(imports.filter((m) => !/^(zustand|\.\/storage)/.test(m))).toEqual([]);
  });
});
