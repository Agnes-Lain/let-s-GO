// Which storage backs the stores (docs/specs/M6-eas-build.md §4.3, AC 13–20).
// - Web and the App Store Expo Go ('storeClient') use AsyncStorage; MMKV is never loaded there.
// - The app's own build (standalone / dev client) uses MMKV, after copying the AsyncStorage keys
//   once. If MMKV cannot load or the copy fails, the app keeps working on AsyncStorage.
// The environment is injected, so this file has no React Native import and is easy to test.
import type { StorageAdapter } from './storage';

/** The part of an MMKV instance the app uses. */
export interface MmkvLike {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): unknown;
}

export interface StorageEnv {
  /** `Platform.OS`: 'ios' | 'android' | 'web' | … */
  platform: string;
  /** `Constants.executionEnvironment`: 'storeClient' (Expo Go), 'standalone', 'bare'. */
  executionEnvironment: string | undefined;
  /** The AsyncStorage adapter (the fallback, and the source of the one-time copy). */
  asyncStorage: StorageAdapter;
  /**
   * Creates the MMKV instance; throws when the native module is missing. Called only where MMKV
   * may be used, so Expo Go and web never execute the MMKV `require` inside it.
   */
  loadMmkv: () => MmkvLike;
}

/** Set in MMKV once the AsyncStorage keys were copied. */
export const MMKV_MIGRATION_FLAG = 'migration.mmkv.v1';

/** Every key the stores save: progress (lessons, bots, the onboarding flag) and settings. */
export const MIGRATED_KEYS: readonly string[] = ['progress', 'settings'];

/** The `StorageAdapter` over MMKV: synchronous, `null` for a missing key. */
export function createMmkvAdapter(mmkv: MmkvLike): StorageAdapter {
  return {
    getItem: (key) => mmkv.getString(key) ?? null,
    setItem: (key, value) => mmkv.set(key, value),
    removeItem: (key) => {
      mmkv.remove(key);
    },
  };
}

/**
 * Copies `keys` from AsyncStorage to MMKV once. A key MMKV already holds is never replaced; old
 * AsyncStorage keys are kept. On any error the keys copied in this run are removed again and the
 * flag stays unset, so the next launch retries from AsyncStorage. Resolves to true when MMKV is
 * ready to use.
 */
export async function migrateToMmkv({
  from,
  to,
  keys = MIGRATED_KEYS,
}: {
  from: StorageAdapter;
  to: StorageAdapter;
  keys?: readonly string[];
}): Promise<boolean> {
  const copied: string[] = [];
  try {
    if (to.getItem(MMKV_MIGRATION_FLAG) === 'done') return true;
    for (const key of keys) {
      const value = await from.getItem(key);
      if (value === null || to.getItem(key) !== null) continue;
      copied.push(key);
      await to.setItem(key, value);
    }
    await to.setItem(MMKV_MIGRATION_FLAG, 'done');
    return true;
  } catch {
    for (const key of copied) {
      try {
        await to.removeItem(key);
      } catch {
        // Best effort: the flag is unset, so AsyncStorage stays the source of truth.
      }
    }
    return false;
  }
}

/** The adapter the stores use: AsyncStorage, or MMKV (migrated before the first read). */
export function selectStorageAdapter(env: StorageEnv): StorageAdapter {
  if (env.platform === 'web' || env.executionEnvironment === 'storeClient') {
    return env.asyncStorage;
  }
  let mmkv: StorageAdapter;
  try {
    mmkv = createMmkvAdapter(env.loadMmkv());
    if (mmkv.getItem(MMKV_MIGRATION_FLAG) === 'done') return mmkv;
  } catch {
    return env.asyncStorage;
  }
  // First launch on MMKV: every call waits for the copy, then goes to MMKV (or, if the copy
  // failed, to AsyncStorage for this launch). Calls keep their order.
  const ready = migrateToMmkv({ from: env.asyncStorage, to: mmkv }).then((ok) =>
    ok ? mmkv : env.asyncStorage,
  );
  return {
    getItem: (key) => ready.then((storage) => storage.getItem(key)),
    setItem: (key, value) => ready.then((storage) => storage.setItem(key, value)),
    removeItem: (key) => ready.then((storage) => storage.removeItem(key)),
  };
}
