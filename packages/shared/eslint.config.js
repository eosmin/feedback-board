const { defineConfig } = require('eslint/config');
const root = require('../../eslint.config.js');

/**
 * `packages/shared` is bundled into the browser (TDD §4), so it must never import
 * `packages/core` — that would pull Prisma, the AI SDK and every server-only secret into the
 * client bundle. The `files` glob is scoped to this package's own `src/` and `test/` because a
 * flat-config `files` glob resolves against the basePath of the config declaring it — a glob
 * written in the root config would be inert once ESLint runs from inside this package, which is
 * how `pnpm -r lint` invokes it (§2.6.15).
 *
 * `tsconfigRootDir` is set explicitly for the same reason `apps/api/eslint.config.js` and
 * `packages/core/eslint.config.js` set it: more than one `tsconfig.json` exists in this
 * monorepo, and a single long-lived ESLint process (the VS Code extension) visiting files from
 * multiple packages cannot otherwise disambiguate which one applies to a given file.
 */
module.exports = defineConfig(
  ...root,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@feedback-board/core', '@feedback-board/core/*'],
              message:
                'packages/shared is bundled into the browser — it must never import packages/core.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['*.config.js', '*.config.mts'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
  },
);
