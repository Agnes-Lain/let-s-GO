// Jest: never load the native MMKV module (docs/specs/M6-eas-build.md §4.3). Creating an instance
// throws like a build without the native module, so the app's stores fall back to the mocked
// AsyncStorage and every existing store test keeps its behaviour. MMKV logic is tested with a fake
// instance in src/store/storageSelect.test.ts.
export function createMMKV(): never {
  throw new Error('react-native-mmkv is not available in Jest');
}
