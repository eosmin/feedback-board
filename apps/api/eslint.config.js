const { defineConfig } = require('eslint/config');
const root = require('../../eslint.config.js');

// This package needs no rules of its own; the file exists because ESLint resolves the config
// nearest to the linted file, and `pnpm -r lint` runs eslint from inside the package.
module.exports = defineConfig(...root);
