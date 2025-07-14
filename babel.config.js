module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // React Native Paper babel plugin
      'react-native-paper/babel',
      // React Native Reanimated plugin (should be last)
      'react-native-reanimated/plugin',
    ],
  };
};