const path = require('path');
const { getDefaultConfig } = require('@react-native/metro-config');

const root = path.resolve(__dirname, '..');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
async function createConfig() {
  const { withMetroConfig } = await import('react-native-monorepo-config');

  return withMetroConfig(getDefaultConfig(__dirname), {
    root,
    dirname: __dirname,
    conditions: ['react-native-network-resilience-source'],
  });
}

module.exports = createConfig();
