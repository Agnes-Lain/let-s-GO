const path = require('node:path');

// jest-expo's setup requires `expo-modules-core`, which npm may nest under `expo/node_modules`
// depending on peer ranges (it did on SDK 58). Resolve it the same way `expo` does so tests work
// whether or not it is hoisted.
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
