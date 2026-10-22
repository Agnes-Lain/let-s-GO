// Jest config for the 9×9 bot tuning report only (`npm run tune:bot9`, spec M6 AC 7–9).
// Not part of `npm test`: the default config only matches *.test.ts(x).
const base = require('./jest.config');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  testMatch: ['<rootDir>/scripts/**/*.tune9.ts'],
  watchman: false,
  testTimeout: 6 * 60 * 60 * 1000,
};
