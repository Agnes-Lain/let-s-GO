// docs/specs/M6-eas-build.md §4.3, AC 13–20: choosing MMKV or AsyncStorage, and the one-time copy.
import { PROGRESS_KEY } from './progress';
import { SETTINGS_KEY } from './settings';
import { createMemoryStorage, type StorageAdapter } from './storage';
import {
  MIGRATED_KEYS,
  MMKV_MIGRATION_FLAG,
  createMmkvAdapter,
  migrateToMmkv,
  selectStorageAdapter,
  type MmkvLike,
  type StorageEnv,
} from './storageSelect';

/** A fake MMKV instance over a Map (the real one is native and never loaded in Jest). */
function fakeMmkv(initial: Record<string, string> = {}): MmkvLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getString: (key) => data.get(key),
    set: (key, value) => {
      data.set(key, value);
    },
    remove: (key) => data.delete(key),
  };
}

/** An AsyncStorage-like adapter: every call returns a promise, like the real library. */
function fakeAsyncStorage(initial: Record<string, string> = {}): StorageAdapter & {
  data: Map<string, string>;
} {
  const memory = createMemoryStorage(initial);
  return {
    data: memory.data,
    getItem: async (key) => memory.getItem(key),
    setItem: async (key, value) => memory.setItem(key, value),
    removeItem: async (key) => memory.removeItem(key),
  };
}

const SAVED = {
  [PROGRESS_KEY]: '{"version":1,"lessons":{"u01-board":{"stars":3}}}',
  [SETTINGS_KEY]: '{"version":1,"language":"fr","sound":false}',
};

function env(overrides: Partial<StorageEnv> = {}): StorageEnv {
  return {
    platform: 'android',
    executionEnvironment: 'standalone',
    asyncStorage: fakeAsyncStorage(),
    loadMmkv: () => fakeMmkv(),
    ...overrides,
  };
}

describe('MIGRATED_KEYS', () => {
  it('lists the progress key (with the onboarding flag inside) and the settings key', () => {
    expect([...MIGRATED_KEYS].sort()).toEqual([PROGRESS_KEY, SETTINGS_KEY].sort());
  });
});

describe('selectStorageAdapter (AC 13)', () => {
  it('uses AsyncStorage on web and never loads MMKV', () => {
    const loadMmkv = jest.fn(() => fakeMmkv());
    const e = env({ platform: 'web', loadMmkv });
    expect(selectStorageAdapter(e)).toBe(e.asyncStorage);
    expect(loadMmkv).not.toHaveBeenCalled();
  });

  it('uses AsyncStorage in the App Store Expo Go (storeClient) and never loads MMKV', () => {
    const loadMmkv = jest.fn(() => fakeMmkv());
    const e = env({ platform: 'ios', executionEnvironment: 'storeClient', loadMmkv });
    expect(selectStorageAdapter(e)).toBe(e.asyncStorage);
    expect(loadMmkv).not.toHaveBeenCalled();
  });

  it.each(['standalone', 'bare'])('uses MMKV in a %s build when MMKV loads', async (where) => {
    const mmkv = fakeMmkv({ [MMKV_MIGRATION_FLAG]: 'done', [PROGRESS_KEY]: 'from-mmkv' });
    const e = env({ executionEnvironment: where, loadMmkv: () => mmkv });
    const adapter = selectStorageAdapter(e);
    expect(adapter).not.toBe(e.asyncStorage);
    expect(await adapter.getItem(PROGRESS_KEY)).toBe('from-mmkv');
    await adapter.setItem(SETTINGS_KEY, 'new');
    expect(mmkv.data.get(SETTINGS_KEY)).toBe('new');
  });

  it('reads MMKV synchronously once migrated, so the stores hydrate on the first frame', () => {
    const mmkv = fakeMmkv({ [MMKV_MIGRATION_FLAG]: 'done', [PROGRESS_KEY]: 'p' });
    expect(selectStorageAdapter(env({ loadMmkv: () => mmkv })).getItem(PROGRESS_KEY)).toBe('p');
  });

  it('falls back to AsyncStorage without crashing when loading MMKV throws', () => {
    const e = env({
      loadMmkv: () => {
        throw new Error('NitroModules are not available');
      },
    });
    expect(selectStorageAdapter(e)).toBe(e.asyncStorage);
  });
});

describe('createMmkvAdapter (AC 14)', () => {
  it('maps getItem/setItem/removeItem onto MMKV, with null for a missing key', () => {
    const mmkv = fakeMmkv();
    const adapter = createMmkvAdapter(mmkv);
    expect(adapter.getItem('k')).toBeNull();
    adapter.setItem('k', 'v');
    expect(adapter.getItem('k')).toBe('v');
    adapter.removeItem('k');
    expect(adapter.getItem('k')).toBeNull();
    expect(mmkv.data.size).toBe(0);
  });
});

describe('migrateToMmkv', () => {
  it('copies every key once with identical values and sets the flag (AC 16)', async () => {
    const from = fakeAsyncStorage(SAVED);
    const mmkv = fakeMmkv();
    await expect(migrateToMmkv({ from, to: createMmkvAdapter(mmkv) })).resolves.toBe(true);
    expect(mmkv.data.get(PROGRESS_KEY)).toBe(SAVED[PROGRESS_KEY]);
    expect(mmkv.data.get(SETTINGS_KEY)).toBe(SAVED[SETTINGS_KEY]);
    expect(mmkv.data.get(MMKV_MIGRATION_FLAG)).toBe('done');
  });

  it('sets the flag when there is nothing to copy (a fresh install)', async () => {
    const mmkv = fakeMmkv();
    await migrateToMmkv({ from: fakeAsyncStorage(), to: createMmkvAdapter(mmkv) });
    expect([...mmkv.data.entries()]).toEqual([[MMKV_MIGRATION_FLAG, 'done']]);
  });

  it('loses nothing when an MMKV write throws on the 2nd key (AC 17)', async () => {
    const from = fakeAsyncStorage(SAVED);
    const mmkv = fakeMmkv();
    let writes = 0;
    const set = mmkv.set;
    mmkv.set = (key, value) => {
      writes += 1;
      if (writes === 2) throw new Error('disk full');
      set(key, value);
    };
    await expect(migrateToMmkv({ from, to: createMmkvAdapter(mmkv) })).resolves.toBe(false);
    expect(Object.fromEntries(from.data)).toEqual(SAVED);
    expect(mmkv.data.has(MMKV_MIGRATION_FLAG)).toBe(false);
    // The half copy is undone, so the next launch retries from AsyncStorage's newest values.
    expect(mmkv.data.size).toBe(0);
  });

  it('is idempotent: with the flag done, nothing is copied or overwritten (AC 18)', async () => {
    const from = fakeAsyncStorage(SAVED);
    const mmkv = fakeMmkv({ [MMKV_MIGRATION_FLAG]: 'done', [SETTINGS_KEY]: 'newer' });
    await expect(migrateToMmkv({ from, to: createMmkvAdapter(mmkv) })).resolves.toBe(true);
    expect(Object.fromEntries(mmkv.data)).toEqual({
      [MMKV_MIGRATION_FLAG]: 'done',
      [SETTINGS_KEY]: 'newer',
    });
  });

  it('never replaces a key MMKV already holds (AC 19)', async () => {
    const from = fakeAsyncStorage(SAVED);
    const mmkv = fakeMmkv({ [PROGRESS_KEY]: 'mmkv-progress' });
    await migrateToMmkv({ from, to: createMmkvAdapter(mmkv) });
    expect(mmkv.data.get(PROGRESS_KEY)).toBe('mmkv-progress');
    expect(mmkv.data.get(SETTINGS_KEY)).toBe(SAVED[SETTINGS_KEY]);
  });

  it('keeps the old AsyncStorage keys (AC 20)', async () => {
    const from = fakeAsyncStorage(SAVED);
    await migrateToMmkv({ from, to: createMmkvAdapter(fakeMmkv()) });
    expect(Object.fromEntries(from.data)).toEqual(SAVED);
  });

  it('reports failure when reading AsyncStorage rejects, and sets no flag', async () => {
    const from = fakeAsyncStorage(SAVED);
    from.getItem = () => Promise.reject(new Error('read failed'));
    const mmkv = fakeMmkv();
    await expect(migrateToMmkv({ from, to: createMmkvAdapter(mmkv) })).resolves.toBe(false);
    expect(mmkv.data.size).toBe(0);
  });
});

describe('the MMKV adapter migrates before the stores read (AC 16, 17)', () => {
  it('serves the migrated values on the first read', async () => {
    const asyncStorage = fakeAsyncStorage(SAVED);
    const mmkv = fakeMmkv();
    const adapter = selectStorageAdapter(env({ asyncStorage, loadMmkv: () => mmkv }));
    expect(await adapter.getItem(PROGRESS_KEY)).toBe(SAVED[PROGRESS_KEY]);
    expect(mmkv.data.get(MMKV_MIGRATION_FLAG)).toBe('done');
    await adapter.setItem(PROGRESS_KEY, 'next');
    expect(mmkv.data.get(PROGRESS_KEY)).toBe('next');
    expect(asyncStorage.data.get(PROGRESS_KEY)).toBe(SAVED[PROGRESS_KEY]);
  });

  it('keeps working on AsyncStorage for this launch when the migration fails', async () => {
    const asyncStorage = fakeAsyncStorage(SAVED);
    const mmkv = fakeMmkv();
    mmkv.set = () => {
      throw new Error('disk full');
    };
    const adapter = selectStorageAdapter(env({ asyncStorage, loadMmkv: () => mmkv }));
    expect(await adapter.getItem(SETTINGS_KEY)).toBe(SAVED[SETTINGS_KEY]);
    await adapter.setItem(SETTINGS_KEY, 'changed');
    expect(asyncStorage.data.get(SETTINGS_KEY)).toBe('changed');
  });
});

describe('the app adapter (AC 15)', () => {
  it('is chosen in src/store/asyncStorage.ts; in Jest MMKV cannot load, so it is AsyncStorage', () => {
    const { appStorageAdapter, asyncStorageAdapter } =
      jest.requireActual<typeof import('./asyncStorage')>('./asyncStorage');
    expect(appStorageAdapter).toBe(asyncStorageAdapter);
  });

  it('no store file imports react-native-mmkv except asyncStorage.ts', () => {
    const fs = jest.requireActual<typeof import('node:fs')>('node:fs');
    const path = jest.requireActual<typeof import('node:path')>('node:path');
    const offenders = fs
      .readdirSync(__dirname)
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter((file) => file !== 'asyncStorage.ts')
      .filter((file) =>
        fs.readFileSync(path.join(__dirname, file), 'utf8').includes('react-native-mmkv'),
      );
    expect(offenders).toEqual([]);
  });
});
