import type { Config } from 'jest';

/**
 * 90/85/90 globally (TDD §14.1) — the worker has no per-path keys, the same shape as
 * `packages/core`'s config: everything here is a critical path by construction, since it is
 * the process that writes tenant data on RLS's behalf with no HTTP guard chain in front of it.
 */
const config: Config = {
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // `tsconfig.base.json`'s `"module": "nodenext"` requires an explicit `.js` extension on
  // relative imports even when the source is `.ts` — TypeScript rewrites the specifier at
  // resolution time, not at emit time. `worker.module.spec.ts` uses dynamic `import(...)` (to
  // set `process.env` before `worker.module.ts` reads it at module-evaluation time) with `.js`
  // suffixes for exactly that reason. Jest's CommonJS-era resolver takes the extension
  // literally and looks for a compiled file that was never emitted (there is no build step
  // here; ts-jest compiles in memory) — the same problem `packages/core/jest.config.ts`
  // documents and fixes for its generated Prisma client's own NodeNext-style imports.
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
  coveragePathIgnorePatterns: ['/node_modules/', '\\.module\\.ts$', '/src/main\\.ts$'],
};

export default config;
