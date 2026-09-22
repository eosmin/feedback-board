import type { Config } from 'jest';

/**
 * Coverage thresholds are the TDD §14.1 block, phased in per decision D12 (see
 * IMPLEMENTATION_PLAN.md's "Open decisions"): a per-path key is added only in the same commit
 * that creates its directory, because a key whose directory holds no file aborts the run. Today
 * this holds four of the eventual six keys — `./src/billing/` lands in Step 13, `./src/public/`
 * in Step 12, each appended here alongside the module it gates.
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
 */
const config: Config = {
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
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
    './src/database/': { statements: 90, branches: 85, functions: 90, lines: 90 },
    './src/queue/': { statements: 90, branches: 85, functions: 90, lines: 90 },
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '\\.module\\.ts$',
    '\\.dto\\.ts$',
    '/src/main\\.ts$',
  ],
};

export default config;
