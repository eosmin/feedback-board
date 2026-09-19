const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');

const root = require('../../eslint.config.js');

/**
 * `packages/core` adds type-aware linting on top of the shared root config, scoped to this
 * package only (§7.2/§7.6 do not require it project-wide — see the Step 5 "Open follow-up").
 * `@typescript-eslint/no-deprecated` catches deprecations in *third-party* dependencies that
 * the static grep list in `scripts/check-deprecations.sh` can never anticipate — exactly the
 * class of bug Prisma 7 produces on every major/minor bump (e.g. a generator option or a
 * datasource field marked deprecated mid-major, the way §2.6.4 documents happened here).
 *
 * `recommendedTypeChecked` (not just the single rule) is pulled in because `no-deprecated`
 * requires the type-aware parser service either way, and the preset is the maintained,
 * documented way to turn that on — enabling `projectService` for one hand-picked rule and
 * none of the preset would be reinventing what the preset already does.
 */
module.exports = defineConfig(
  ...root,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-deprecated': 'error',
    },
  },
  {
    // Root-level tooling files in THIS package (eslint.config.js, jest.config.ts,
    // prisma.config.ts) have no owning tsconfig entry in the type-aware program above —
    // `tsconfig.json`'s `include` only lists `src/**`, `test/**` and itself. Without this,
    // the project service throws "file was not found in any project" for every one of them.
    // `tsconfigRootDir` must still be set even with type checking disabled, or the parser
    // cannot decide between this package's tsconfig and the monorepo root's.
    files: ['*.config.js', '*.config.ts'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // The root config's own `*.config.js` block (CommonJS `require`/`module.exports`)
      // does not apply here: flat-config `files` globs resolve against the basePath of the
      // config that DECLARES them (the same rule §2.6.15 relies on for the shared/core
      // import ban), so the root file's `files: ['*.config.js']` block never matches when
      // ESLint runs from inside this package. Re-declare the override locally.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // The generated Prisma client is excluded from lint entirely by the root config's
    // `ignores` (`packages/core/src/generated/**`), but `ignores` alone does not stop the
    // type-aware project service from trying to resolve these files when it builds its
    // program — ignoring the rule set is not ignoring the parse. Turn type checking off for
    // them explicitly, or every generated file fails with "not found by the project service".
    files: ['src/generated/**/*.ts'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
  },
);
