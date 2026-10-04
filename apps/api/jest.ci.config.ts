import type { Config } from 'jest';

import baseConfig from './jest.config.ts';

/**
 * CI-only entry point (TDD §15): the unit and e2e suites cover different halves of `apps/api`, so
 * the §14.1 thresholds must be applied to their union, not to each run. Jest does that natively
 * when both are projects of one run: coverage is collected across projects into a single report
 * and `coverageThreshold` (a global-only option, which is why it lives here and not in the
 * project configs) is checked once against it. No extra merge tool or dependency is needed.
 *
 * `--runInBand` is required by the e2e project (shared database and Redis); see the `test:ci`
 * script.
 */
const config: Config = {
  ...baseConfig,
  projects: ['<rootDir>/jest.config.ts', '<rootDir>/jest.e2e.config.ts'],
};

export default config;
