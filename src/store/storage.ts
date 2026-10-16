// Storage adapter (spec §11 Q1): the progress store talks to this tiny interface, so the backing
// library can change (AsyncStorage now, MMKV after the EAS build in M6) in one file.

export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

/** Synchronous in-memory storage, for tests and as a fallback. */
export function createMemoryStorage(initial: Record<string, string> = {}): StorageAdapter & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}
