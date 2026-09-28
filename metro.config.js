// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname, {
  // [Web-only]: Enables CSS support in Metro.
  isCSSEnabled: true,
});

// Allows importing drizzle-kit's generated .sql migration files (bundled
// as strings via the babel-plugin-inline-import config in babel.config.js).
config.resolver.sourceExts.push('sql');

module.exports = config;