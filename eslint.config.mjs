import { fixupConfigRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import { defineConfig } from 'eslint/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  {
    extends: fixupConfigRules(compat.extends('@react-native', 'prettier')),
    plugins: { prettier },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'prettier/prettier': 'error',
    },
  },
  {
    // Plain JS/JSX files (config scripts, entry points, etc.) are parsed
    // directly. Loading the project's Babel config (react-native-builder-bob)
    // pulls in a native-ESM plugin that only works when Babel runs
    // asynchronously or under Node >=22, so we skip it here.
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      parserOptions: {
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        requireConfigFile: false,
        babelOptions: { configFile: false, babelrc: false },
      },
    },
  },
  {
    ignores: ['node_modules/', 'lib/'],
  },
]);
