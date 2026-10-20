// Jest config for the SGF import script only (`npm run import:sgf`, spec M5-sgf-import AC 20).
// Not part of `npm test`: the default config only matches *.test.ts(x).
const base = require('./jest.config');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  testMatch: ['<rootDir>/scripts/import-sgf.run.ts'],
  watchman: false,
};
