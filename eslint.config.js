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
    // scripts loaded directly by their tools, not part of any package's TypeSc/module.exports here is correct, not a stray CommonJS import (TDD §7.1: no
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
    // outside the files that own those callers must go through TenantPrismaService.
    //
    // The globs here are deliberately basePath-independent (`**/src/**` rather than
    // `apps/api/src/**`). A flat-config `files` glob is matched against the path relative to
    // the config's basePath, so `apps/api/src/**` matches nothing when ESLint runs from inside
    // apps/api — which is how `pnpm -r lint` invokes it. That spelling left this rule inert
    // while still reading as correct.
    files: ['**/src/**/*.ts'],
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
    // The five callers of §3.2, and nothing else. The two org collection routes are named
    // file-by-file rather than as `orgs/**`: caller 4 is only POST /orgs and GET /orgs, so
    // widening this to the whole module would hand the admin client to every tenant-scoped
    // service that later lands beside them. Likewise caller 3 is org.guard.ts alone — neither
    // RolesGuard nor PlanGuard may reach the admin client (§3.9 routes PlanGuard's counts
    // through TenantPrismaService).
    //
    // `src/index.ts` is also exempt, package-wide: it is each package's public barrel, and
    // re-exporting `PrismaService` from `packages/core`'s barrel is not itself a sixth caller —
    // it only makes the class importable as `@feedback-board/core`. The five-caller boundary is
    // still enforced where it matters: at each *consumer* of that export, none of which is a
    // package or app entry point, so every import of `PrismaService` from outside this list
    // still trips the restriction. `packages/shared/src/index.ts` never imports it at all, so
    // widening the glob here does not open anything there.
    files: [
      '**/src/database/**/*.ts',
      '**/src/billing/**/*.ts',
      '**/src/auth/**/*.ts',
      '**/src/orgs/orgs.service.ts',
      '**/src/orgs/orgs.controller.ts',
      '**/src/orgs/guards/org.guard.ts',
      '**/src/public/**/*.ts',
      '**/src/index.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  prettier,
);
