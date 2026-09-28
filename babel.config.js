module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // React Native Paper babel plugin
      'react-native-paper/babel',
      // React Native Worklets plugin (should be last; replaces the old
      // react-native-reanimated/plugin now that Reanimated 4 splits
      // worklets into its own package)
      'react-native-worklets/plugin',
    ],
  };
};