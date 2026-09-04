const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'supabase/*'],
  },
  {
    rules: {
      'import/order': 'off',
      // React Hook Formのwatch()はReact Compilerのメモ化対象外だが、
      // 本プロジェクトの標準フォームライブラリとして意図的に採用しているため許容する。
      'react-hooks/incompatible-library': 'off',
    },
  },
]);
