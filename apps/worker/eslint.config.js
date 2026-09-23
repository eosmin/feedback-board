const { defineConfig } = require('eslint/config');
const root = require('../../eslint.config.js');

/**
 * Same shape as apps/api/eslint.config.js: no rules of its own beyond the root config, but the
 * file must exist because ESLint resolves the config nearest to the linted file and
 * `pnpm -r lint` runs eslint from inside each package. `tsconfigRootDir` disambiguates this
 * package's tsconfig from the monorepo's other tsconfig.json files (same note as
 * packages/core/eslint.config.js and apps/api/eslint.config.js).
 */
module.exports = defineConfig(...root, {
  files: ['src/**/*.ts', 'test/**/*.ts'],
  languageOptions: {
    parserOptions: {
      tsconfigRootDir: __dirname,
    },
  },
});
