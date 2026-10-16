// The app's storage adapter: AsyncStorage works in the App Store Expo Go and on web. MMKV is
// not part of Expo Go (spec §11 Q1); swap this file when the app gets its own build (M6).
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StorageAdapter } from './storage';

export const asyncStorageAdapter: StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};
