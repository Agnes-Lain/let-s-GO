// QA edge cases for docs/specs/M6-eas-build.md §4.3 (races during the first-launch copy, throwing reads).
import * as fs from 'fs';
import * as path from 'path';

import { createMemoryStorage, type StorageAdapter } from './storage';
import {
  MMKV_MIGRATION_FLAG,
  migrateToMmkv,
  selectStorageAdapter,
  type MmkvLike,
  type StorageEnv,
} from './storageSelect';

function fakeMmkv(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const m: MmkvLike & { data: Map<string, string> } = {
    data,
    getString: (k) => data.get(k),
    set: (k, v) => {
      data.set(k, v);
    },
    remove: (k) => data.delete(k),
  };
  return m;
}

/** AsyncStorage whose getItem resolves only when `release()` is called. */
function slowAsync(initial: Record<string, string>) {
  const mem = createMemoryStorage(initial);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const adapter: StorageAdapter & { data: Map<string, string> } = {
    data: mem.data,
    getItem: async (k) => {
      await gate;
      return mem.getItem(k);
    },
    setItem: async (k, v) => mem.setItem(k, v),
    removeItem: async (k) => mem.removeItem(k),
  };
  return { adapter, release };
}

const env = (o: Partial<StorageEnv>): StorageEnv => ({
  platform: 'android',
  executionEnvironment: 'standalone',
  asyncStorage: createMemoryStorage(),
  loadMmkv: () => fakeMmkv(),
  ...o,
});

describe('first-launch migration races', () => {
  it('a setItem issued while the copy runs is not overwritten by the copy', async () => {
    const { adapter, release } = slowAsync({ progress: 'OLD', settings: 'S' });
    const mmkv = fakeMmkv();
    const sel = selectStorageAdapter(env({ asyncStorage: adapter, loadMmkv: () => mmkv }));
    const write = sel.setItem('progress', 'NEW');
    const read = sel.getItem('progress');
    release();
    await write;
    expect(await read).toBe('NEW');
    expect(mmkv.data.get('progress')).toBe('NEW');
    expect(mmkv.data.get('settings')).toBe('S');
    expect(mmkv.data.get(MMKV_MIGRATION_FLAG)).toBe('done');
  });

  it('a removeItem during the copy wins over the copied value', async () => {
    const { adapter, release } = slowAsync({ progress: 'OLD' });
    const mmkv = fakeMmkv();
    const sel = selectStorageAdapter(env({ asyncStorage: adapter, loadMmkv: () => mmkv }));
    const rm = sel.removeItem('progress');
    release();
    await rm;
    expect(await sel.getItem('progress')).toBeNull();
  });

  it('a write during a failing copy goes to AsyncStorage and is copied on the next launch', async () => {
    const { adapter, release } = slowAsync({ progress: 'OLD', settings: 'S' });
    const mmkv = fakeMmkv();
    const realSet = mmkv.set;
    mmkv.set = (k, v) => {
      if (k === 'settings') throw new Error('disk full');
      realSet(k, v);
    };
    const sel = selectStorageAdapter(env({ asyncStorage: adapter, loadMmkv: () => mmkv }));
    const write = sel.setItem('progress', 'NEW');
    release();
    await write;
    expect(adapter.data.get('progress')).toBe('NEW');
    expect(mmkv.data.has('progress')).toBe(false);
    expect(mmkv.data.has(MMKV_MIGRATION_FLAG)).toBe(false);
    // next launch, MMKV healthy again
    mmkv.set = realSet;
    const sel2 = selectStorageAdapter(env({ asyncStorage: adapter, loadMmkv: () => mmkv }));
    expect(await sel2.getItem('progress')).toBe('NEW');
  });

  it('two concurrent launches of the selector copy the same values (idempotent)', async () => {
    const as = createMemoryStorage({ progress: 'P' });
    const mmkv = fakeMmkv();
    const a = selectStorageAdapter(env({ asyncStorage: as, loadMmkv: () => mmkv }));
    const b = selectStorageAdapter(env({ asyncStorage: as, loadMmkv: () => mmkv }));
    expect(await a.getItem('progress')).toBe('P');
    expect(await b.getItem('progress')).toBe('P');
    expect(as.data.get('progress')).toBe('P');
  });
});

describe('AsyncStorage read failures', () => {
  it('getItem throwing synchronously rolls back and keeps AsyncStorage intact', async () => {
    const as = createMemoryStorage({ progress: 'P', settings: 'S' });
    const from: StorageAdapter = {
      ...as,
      getItem: (k) => {
        if (k === 'settings') throw new Error('boom');
        return as.getItem(k);
      },
    };
    const mmkv = fakeMmkv();
    const ok = await migrateToMmkv({
      from,
      to: {
        getItem: (k) => mmkv.getString(k) ?? null,
        setItem: (k, v) => mmkv.set(k, v),
        removeItem: (k) => void mmkv.remove(k),
      },
    });
    expect(ok).toBe(false);
    expect(mmkv.data.size).toBe(0);
    expect(as.data.get('progress')).toBe('P');
    expect(as.data.get('settings')).toBe('S');
  });

  it('after a failed migration the selector serves AsyncStorage for the whole launch', async () => {
    const as = createMemoryStorage({ progress: 'P' });
    const bad: StorageAdapter = {
      ...as,
      getItem: async () => {
        throw new Error('boom');
      },
    };
    const sel = selectStorageAdapter(env({ asyncStorage: bad }));
    await expect(sel.getItem('progress')).rejects.toThrow('boom');
    await sel.setItem('progress', 'Q');
    expect(as.data.get('progress')).toBe('Q');
  });
});

describe('static: MMKV is required lazily', () => {
  const src = fs.readFileSync(path.join(__dirname, 'asyncStorage.ts'), 'utf8');
  it('has no top-level import of react-native-mmkv, only a require inside loadMmkv', () => {
    expect(src).not.toMatch(/^import .*react-native-mmkv/m);
    const fn = src.slice(
      src.indexOf('function loadMmkv'),
      src.indexOf('export const appStorageAdapter'),
    );
    expect(fn).toContain("require('react-native-mmkv')");
    expect(src.match(/require\('react-native-mmkv'\)/g)).toHaveLength(1);
  });
  it('storageSelect.ts never mentions the native module as an import', () => {
    const sel = fs.readFileSync(path.join(__dirname, 'storageSelect.ts'), 'utf8');
    expect(sel).not.toMatch(/(import|require).*react-native-mmkv/);
  });
});
