// QA edge cases for M6 settings/onboarding storage (docs/specs/M6-settings-onboarding-a11y.md
// AC 3, 21, 24, 51): old, corrupt and half-written saves must never throw or lose valid data.
import { shouldShowOnboarding } from './onboarding';
import { createProgressStore, PROGRESS_KEY } from './progress';
import { createSettingsStore, SETTINGS_KEY } from './settings';
import { createMemoryStorage, type StorageAdapter } from './storage';

const lesson = {
  stars: 2,
  plays: 1,
  bestClean: 3,
  bestSolved: 4,
  total: 5,
  lastPlayedAt: '2026-10-16T08:00:00.000Z',
};
const asyncStorage = (initial: Record<string, string>): StorageAdapter => {
  const inner = createMemoryStorage(initial);
  return {
    getItem: (k) => Promise.resolve(inner.getItem(k) as string | null),
    setItem: (k, v) => Promise.resolve(inner.setItem(k, v)),
    removeItem: (k) => Promise.resolve(inner.removeItem(k)),
  };
};
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('progress hydrate: old and corrupt saves', () => {
  it('a save holding only u00-sample hydrates to no progress, so the intro still shows', () => {
    const storage = createMemoryStorage({
      [PROGRESS_KEY]: JSON.stringify({
        v: 1,
        lessons: { 'u00-sample': lesson },
        bots: {},
        flags: {},
      }),
    });
    const s = createProgressStore({ storage, units: () => [] }).getState();
    expect(s.lessons).toEqual({});
    expect(shouldShowOnboarding(s)).toBe(true);
  });

  it('async storage: u00-sample is dropped when the read resolves; real lessons stay', async () => {
    const storage = asyncStorage({
      [PROGRESS_KEY]: JSON.stringify({
        v: 1,
        lessons: { 'u00-sample': lesson, 'u02-stones': lesson },
        bots: {},
        flags: {},
      }),
    });
    const store = createProgressStore({ storage, units: () => [] });
    expect(store.getState().hydrated).toBe(false);
    await flush();
    expect(store.getState().hydrated).toBe(true);
    expect(Object.keys(store.getState().lessons)).toEqual(['u02-stones']);
  });

  it('flags that are not literally true are ignored (strings, numbers)', () => {
    const storage = createMemoryStorage({
      [PROGRESS_KEY]: JSON.stringify({
        v: 1,
        lessons: {},
        flags: { onboardingSeen: 'true', atariHintsOff: 1, passExplained: true, other: true },
      }),
    });
    const { flags } = createProgressStore({ storage, units: () => [] }).getState();
    expect(flags).toEqual({ passExplained: true });
  });

  it('a corrupt progress value loads empty, shows the intro, and the next save repairs it', () => {
    const storage = createMemoryStorage({ [PROGRESS_KEY]: '{"v":1,"lessons":' });
    const store = createProgressStore({ storage, units: () => [] });
    expect(shouldShowOnboarding(store.getState())).toBe(true);
    store.getState().setFlag('onboardingSeen');
    expect(JSON.parse(storage.data.get(PROGRESS_KEY) as string).flags).toEqual({
      onboardingSeen: true,
    });
  });
});

describe('reset({ keepFlags }) edge cases', () => {
  const full = {
    v: 1,
    lessons: { 'u01-board': lesson },
    bots: { '2': { games: 3, wins: 1, lossStreak: 2, handicap: 3 } },
    flags: {
      passExplained: true,
      easierTipShown: true,
      takebackExplained: true,
      atariHintsOff: true,
      onboardingSeen: true,
    },
  };

  it('keeps only the listed flags and erases handicap suggestions with the bot records', () => {
    const storage = createMemoryStorage({ [PROGRESS_KEY]: JSON.stringify(full) });
    const store = createProgressStore({ storage, units: () => [] });
    store.getState().reset({ keepFlags: ['atariHintsOff', 'onboardingSeen'] });
    expect(store.getState().bots).toEqual({});
    expect(store.getState().lessons).toEqual({});
    expect(store.getState().flags).toEqual({ atariHintsOff: true, onboardingSeen: true });
    const saved = JSON.parse(storage.data.get(PROGRESS_KEY) as string);
    expect(saved).toEqual({
      v: 1,
      lessons: {},
      flags: { atariHintsOff: true, onboardingSeen: true },
    });
  });

  it('a reset learner is not treated as fresh: onboardingSeen survives, so no intro', () => {
    const store = createProgressStore({
      storage: createMemoryStorage({ [PROGRESS_KEY]: JSON.stringify(full) }),
      units: () => [],
    });
    store.getState().reset({ keepFlags: ['atariHintsOff', 'onboardingSeen'] });
    expect(shouldShowOnboarding(store.getState())).toBe(false);
  });

  it('an empty keepFlags list behaves like a plain reset', () => {
    const storage = createMemoryStorage({ [PROGRESS_KEY]: JSON.stringify(full) });
    const store = createProgressStore({ storage, units: () => [] });
    store.getState().reset({ keepFlags: [] });
    expect(store.getState().flags).toEqual({});
    expect(storage.data.has(PROGRESS_KEY)).toBe(false);
  });

  it('never touches the settings key', () => {
    const settings = JSON.stringify({ v: 1, language: 'fr', sound: false, reduceMotion: true });
    const storage = createMemoryStorage({
      [PROGRESS_KEY]: JSON.stringify(full),
      [SETTINGS_KEY]: settings,
    });
    const progress = createProgressStore({ storage, units: () => [] });
    const settingsStore = createSettingsStore({ storage });
    progress.getState().reset({ keepFlags: ['atariHintsOff', 'onboardingSeen'] });
    expect(storage.data.get(SETTINGS_KEY)).toBe(settings);
    expect(settingsStore.getState().language).toBe('fr');
  });
});

describe('settings: half-written saves', () => {
  it('missing fields (only language saved) keep that field and default the rest', () => {
    const storage = createMemoryStorage({
      [SETTINGS_KEY]: JSON.stringify({ v: 1, language: 'zh-CN' }),
    });
    const s = createSettingsStore({ storage }).getState();
    expect([s.language, s.sound, s.reduceMotion]).toEqual(['zh-CN', true, false]);
  });

  it('extra unknown fields are not written back', () => {
    const storage = createMemoryStorage({
      [SETTINGS_KEY]: JSON.stringify({
        v: 1,
        language: 'en',
        sound: true,
        reduceMotion: false,
        x: 1,
      }),
    });
    const store = createSettingsStore({ storage });
    store.getState().setSound(false);
    expect(Object.keys(JSON.parse(storage.data.get(SETTINGS_KEY) as string)).sort()).toEqual([
      'language',
      'reduceMotion',
      'sound',
      'v',
    ]);
  });
});
