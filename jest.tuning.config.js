// Jest config for the bot tuning report only (`npm run tune:bot`, spec M4 item 2 AC 64).
// Not part of `npm test`: the default config only matches *.test.ts(x).
const base = require('./jest.config');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  testMatch: ['<rootDir>/scripts/**/*.tune.ts'],
  watchman: false,
};
