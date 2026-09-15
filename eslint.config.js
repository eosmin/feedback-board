const { defineConfig } = require('eslint/config');
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier');

/**
 * Root flat config (ESLint 10). Each package adds a thin eslint.config.js that requires this
 * one and appends only what it alone needs (eslint-config-next in apps/web).
 *
 * defineConfig (from ESLint core's eslint/config), not tseslint.config: the latter is
 * deprecated in favour of the former (verified against the typescript-eslint docs at this
 * baseline). The two are largely equivalent for a config with no per-block `extends` property,
 * which is what this file is.
 */
module.exports = defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      'packages/core/src/generated/**',
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    rules: {
      // TDD §7.2 — build-blocking, not a warning.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // TDD §7.6 — @ts-ignore is banned; @ts-expect-error needs a stated reason.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 10,
        },
      ],
      // TDD §7.9 — nestjs-pino is the logger.
      'no-console': 'error',
    },
  },

  {
    // Root-level tooling configs (this file, commitlint.config.js) are plain Node CommonJS
    // scripts loaded directly by their tools, not part of any package's TypeScript program —
    // require()/module.exports here is correct, not a stray CommonJS import (TDD §7.1: no
    // "just in case" abstraction, so this stays a plain languageOptions override rather than
    // pulling in the unpinned 'globals' package for four identifiers).
    files: ['*.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: 'writable',
        require: 'readonly',
        exports: 'writable',
        __dirname: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  {
    // TDD §3.2 — PrismaService is the admin client and has exactly five callers. Anything
    // outside the directories that own those callers must go through TenantPrismaService.
    files: ['apps/api/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/database/prisma.service', '**/database/prisma.service.js'],
              message:
                'PrismaService bypasses RLS and has exactly five callers (TDD §3.2). Use TenantPrismaService.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'apps/api/src/database/**/*.ts',
      'apps/api/src/billing/**/*.ts',
      'apps/api/src/auth/**/*.ts',
      'apps/api/src/orgs/guards/**/*.ts',
      'apps/api/src/public/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  prettier,
);
