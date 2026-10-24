// The app's storage adapter, the single place that picks it (docs/specs/M6-eas-build.md AC 15):
// MMKV in the app's own build, AsyncStorage in the App Store Expo Go and on web (see
// storageSelect.ts). No store file imports MMKV directly.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { StorageAdapter } from './storage';
import { selectStorageAdapter, type MmkvLike } from './storageSelect';

export const asyncStorageAdapter: StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

function loadMmkv(): MmkvLike {
  // Required lazily: Expo Go has no MMKV native module, so this line must not run there.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
  return createMMKV({ id: 'lets-go' });
}

/** The adapter the progress and settings stores save through. */
export const appStorageAdapter: StorageAdapter = selectStorageAdapter({
  platform: Platform.OS,
  executionEnvironment: Constants.executionEnvironment,
  asyncStorage: asyncStorageAdapter,
  loadMmkv,
});
