const { defineConfig } = require('eslint/config');
const root = require('../../eslint.config.js');

/**
 * `packages/shared` is bundled into the browser (TDD §4), so it must never import
 * `packages/core` — that would pull Prisma, the AI SDK and every server-only secret into the
 * client bundle. The `files` glob is scoped to this package's own `src/` and `test/` because a
 * flat-config `files` glob resolves against the basePath of the config declaring it — a glob
 * written in the root config would be inert once ESLint runs from inside this package, which is
 * how `pnpm -r lint` invokes it (§2.6.15).
 */
module.exports = defineConfig(...root, {
  files: ['src/**/*.ts', 'test/**/*.ts'],
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
});
