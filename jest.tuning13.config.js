// Jest config for the 13×13 bot tuning report only (`npm run tune:bot13`, spec M6b-2 AC 10).
// Not part of `npm test`: the default config only matches *.test.ts(x).
const base = require('./jest.config');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  testMatch: ['<rootDir>/scripts/**/*.tune13.ts'],
  watchman: false,
  testTimeout: 6 * 60 * 60 * 1000,
};
