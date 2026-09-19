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
