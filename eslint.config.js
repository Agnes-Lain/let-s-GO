// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

// The rules engine and the bot must stay pure TypeScript (see CLAUDE.md rule 2).
const pureModuleRestrictions = {
  files: ['src/engine/**', 'src/bot/**'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          { name: 'react', message: 'src/engine and src/bot must stay pure TS (no React).' },
          {
            name: 'react-native',
            message: 'src/engine and src/bot must stay pure TS (no React Native).',
          },
        ],
        patterns: [
          {
            group: ['react/*', 'react-native/*', 'expo', 'expo*', 'expo/*', 'expo-*/**', '@expo/*'],
            message: 'src/engine and src/bot must stay pure TS (no React, React Native or Expo).',
          },
        ],
      },
    ],
  },
};

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  pureModuleRestrictions,
  {
    ignores: ['dist/*', 'web-build/*', '.expo/*', 'node_modules/*', 'coverage/*', 'expo-env.d.ts'],
  },
]);
