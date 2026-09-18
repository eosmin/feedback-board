import type { Config } from 'jest';

/**
 * Coverage thresholds are the TDD §14.1 block verbatim. The six per-path keys are directory
 * prefixes, not patterns: a key whose directory holds no file aborts the run, which is why a
 * module and its threshold must move in the same commit.
 *
 * `*.module.ts` is excluded, so no security decision may live in a module file (§14.1).
 */
const config: Config = {
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts', '<rootDir>/test/**/*.e2e-spec.ts'],
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
