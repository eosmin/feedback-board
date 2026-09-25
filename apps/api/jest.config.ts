import type { Config } from 'jest';

/**
 * Coverage thresholds are the TDD §14.1 block, phased in per decision D12 (see
 * IMPLEMENTATION_PLAN.md's "Open decisions"): a per-path key is added only in the same commit
 * that creates its directory, because a key whose directory holds no file aborts the run. All six
 * keys are present as of Step 13: `./src/public/` arrived with its module in Step 12 and
 * `./src/billing/` with its module in Step 13.
 *
 * `*.module.ts` is excluded, so no security decision may live in a module file (§14.1).
 *
 * `testMatch` covers only `test/unit/**` now — `test/e2e/**` moved to its own
 * `jest.e2e.config.ts`. Splitting the two configs, rather than keeping one `testMatch` covering
 * both and filtering with a fixed `--testPathPatterns test/e2e` flag on the `test:e2e` script,
 * is what lets a trailing `pnpm --filter api test:e2e -- posts` argument work as a genuine
 * single-file filter: Jest's own CLI already treats a bare positional argument as a test-path
 * pattern (`jest posts` — no flag needed), but that pattern is OR-combined with any pattern the
 * script itself already passes via `--testPathPatterns`, so a script that hardcodes
 * `test/e2e` there always matches the whole directory regardless of what a caller appends.
 * Scoping the directory in `testMatch` instead removes the need for that flag entirely.
 *
 * `moduleNameMapper` strips a trailing `.js` off any relative specifier before Jest resolves it
 * — the same fix `apps/worker/jest.config.ts` already carries and documents in full. Root
 * cause: `tsconfig.base.json`'s `"module": "nodenext"` requires an explicit `.js` extension on
 * every relative import, including a dynamic `import(...)`, even though the source file is
 * `.ts` — TypeScript rewrites the specifier at type-check time, not at emit time, so `tsc` both
 * requires and accepts it. Jest's resolver, unlike `tsc`, takes that extension literally and
 * looks for a compiled `.js` file that was never emitted (`ts-jest` compiles in memory; there is
 * no build step in a test run), which fails only for files that actually use a dynamic
 * `import()` — `test/e2e/bull-board.e2e-spec.ts` is the first one in this package. Every static
 * import in `apps/api` already omits the extension and resolves fine under both `tsc` and Jest,
 * because `ts-jest`'s own transform rewrites those before Jest's resolver ever sees them; only a
 * dynamic `import()` call reaches Jest's resolver with the literal string from source.
 */
const config: Config = {
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: { statements: 80, branches: 75, functions: 80, lines: 80 },
    './src/auth/': { statements: 90, branches: 85, functions: 90, lines: 90 },
    './src/orgs/guards/': { statements: 90, branches: 85, functions: 90, lines: 90 },
    './src/billing/': { statements: 90, branches: 85, functions: 90, lines: 90 },
    './src/database/': { statements: 90, branches: 85, functions: 90, lines: 90 },
    './src/queue/': { statements: 90, branches: 85, functions: 90, lines: 90 },
    './src/public/': { statements: 90, branches: 85, functions: 90, lines: 90 },
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '\\.module\\.ts$',
    '\\.dto\\.ts$',
    '/src/main\\.ts$',
  ],
};

export default config;
