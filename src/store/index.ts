// App stores (Zustand). Progress is saved on the phone through a storage adapter (spec §11 Q1).
import { useStore } from 'zustand';

import { getUnits } from '@/lessons';

import { asyncStorageAdapter } from './asyncStorage';
import { createProgressStore, type ProgressState } from './progress';

export * from './progress';
export { createMemoryStorage, type StorageAdapter } from './storage';

/** The app's progress store, read from AsyncStorage at start-up. */
export const progressStore = createProgressStore({
  storage: asyncStorageAdapter,
  units: () => getUnits(),
});

/** React hook over the progress store: `useProgress((s) => s.lessons)`. */
export function useProgress<T>(selector: (state: ProgressState) => T): T {
  return useStore(progressStore, selector);
}
