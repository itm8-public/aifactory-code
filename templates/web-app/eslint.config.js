import js from '@eslint/js';
import tseslint from 'typescript-eslint';
// @if spa
import reactHooks from 'eslint-plugin-react-hooks';
// @endif
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'drizzle/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-console': ['error', { allow: ['error'] }],
    },
  },
// @if spa
  {
    files: ['src/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
// @endif
  {
    files: ['src/server/db/migrate.ts', 'scripts/**', 'copilot/scripts/**'],
    rules: { 'no-console': 'off' },
  },
);
