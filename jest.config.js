const path = require('node:path');

// jest-expo's setup requires `expo-modules-core`, which npm nests under `expo/node_modules` in
// SDK 58 (its optional peer range for react-native-worklets does not include the SDK's 0.13).
// Resolve it the same way `expo` does so tests work whether or not it is hoisted.
const expoModulesCoreDir = path.dirname(
  require.resolve('expo-modules-core/package.json', { paths: [require.resolve('expo')] }),
);

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^expo-modules-core$': expoModulesCoreDir,
    '^expo-modules-core/(.*)$': `${expoModulesCoreDir}/$1`,
  },
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/dist/'],
};
