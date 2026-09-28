// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Custom project rules (ported from the legacy .eslintrc.js).
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
])
