const { defineConfig } = require('eslint/config');
const root = require('../../eslint.config.js');

/**
 * This package needs no rules of its own beyond the root config; the file exists because
 * ESLint resolves the config nearest to the linted file, and `pnpm -r lint` runs eslint from
 * inside the package.
 *
 * `tsconfigRootDir` is set explicitly even though this package enables no type-aware linting
 * of its own — the monorepo has more than one `tsconfig.json` (this one and
 * `packages/core/tsconfig.json`, which does turn on `projectService`), and without an explicit
 * root the `typescript-eslint` parser cannot always disambiguate which one applies once a
 * single long-lived process (the VS Code ESLint extension, not a one-shot CLI run) has visited
 * files from more than one package. `packages/core/eslint.config.js` documents the same fix for
 * the same reason.
 */
module.exports = defineConfig(...root, {
  files: ['src/**/*.ts', 'test/**/*.ts'],
  languageOptions: {
    parserOptions: {
      tsconfigRootDir: __dirname,
    },
  },
});
