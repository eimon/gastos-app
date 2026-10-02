// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Custom project rules (ported from the legacy .eslintrc.js). Scoped to
    // TS/TSX only: `@typescript-eslint` is only registered as a plugin for
    // files eslint-config-expo/flat's own TS block matches, so applying this
    // rule to a plain .js file (e.g. babel.config.js) with no `files` glob
    // here crashes ESLint with "could not find plugin @typescript-eslint".
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
])
