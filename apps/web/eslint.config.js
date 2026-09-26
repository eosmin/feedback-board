const { defineConfig } = require('eslint/config');
const nextVitals = require('eslint-config-next/core-web-vitals');
const nextTs = require('eslint-config-next/typescript');
const root = require('../../eslint.config.js');

/**
 * `eslint-config-next` 16 ships flat-config exports directly — no `FlatCompat` bridge needed.
 * ESLint is pinned at 9.39.5 here (TDD §2.5), not 10.x: `eslint-plugin-react`, a transitive
 * dependency of `eslint-config-next`, calls the ESLint-10-removed `context.getFilename()` at
 * runtime (vercel/next.js#89764, unresolved upstream at this baseline).
 */
module.exports = defineConfig(
  ...root,
  ...nextVitals,
  ...nextTs,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ['*.config.js', '*.config.mjs', '*.config.ts'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    ignores: ['.next/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'],
  },
);
