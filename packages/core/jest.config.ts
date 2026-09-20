import type { Config } from 'jest';

/**
 * Every file in this package is a critical path by construction (TDD §14.1): it is shared by
 * apps/api and apps/worker, so one global 90/85/90 block applies, with no per-path keys.
 */
const config: Config = {
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Prisma's generated client (src/generated/prisma/**, §2.6.4) is authored NodeNext-style,
  // with explicit .js extensions on its own relative imports (e.g. `from "./internal/class.js"`)
  // — correct for `tsc`, which resolves a .js specifier against the sibling .ts source, but
  // Jest's CommonJS-era resolver takes the extension literally and looks for a file that was
  // never emitted (there is no build step here; ts-jest compiles in memory). Only the generated
  // tree needs the rewrite: every hand-written import in this package already omits extensions.
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
    global: { statements: 90, branches: 85, functions: 90, lines: 90 },
  },
  coveragePathIgnorePatterns: ['/node_modules/', '/src/generated/prisma/', '\\.module\\.ts$'],
};

export default config;
