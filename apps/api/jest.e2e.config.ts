import type { Config } from 'jest';

import baseConfig from './jest.config.ts';

/**
 * e2e's own config, split from `jest.config.ts` (TDD §14: e2e needs `supabase start`, a real
 * Redis and Stripe CLI on the host — it is never part of `pnpm test`/`test:cov`, only
 * `pnpm test:e2e`). `testMatch` is narrowed to `test/e2e/**` so a bare trailing CLI argument —
 * `pnpm --filter api test:e2e -- posts`, which pnpm forwards to Jest as a plain positional
 * argument — behaves as Jest's own documented single-argument filter (`jest posts` is
 * equivalent to `jest --testPathPatterns posts`) scoped to this directory, with no
 * `--testPathPatterns` flag needed on the script itself.
 *
 * Coverage settings (`collectCoverageFrom`, `coverageThreshold`) are inherited unchanged from
 * `baseConfig` rather than disabled here: TDD §15's `api.yml` runs unit and e2e **each** with
 * `--coverage` and merges the two reports into one before applying the §14.1 thresholds — e2e
 * coverage counts toward `apps/api`'s gate because it exercises the real guards and RLS
 * policies, not a mocked substitute. This file must not diverge from that shape; it only
 * narrows which files run, never what gets measured.
 *
 * The `.ts` extension on the import is required, not stylistic: when Jest parses a TypeScript
 * config file it first tries Node's own native type-stripping, which — unlike ts-node/esbuild
 * — resolves ESM imports literally and has no implicit-extension fallback, so an extensionless
 * `from './jest.config'` throws `ERR_MODULE_NOT_FOUND` (confirmed against jestjs/jest#15837).
 */
const config: Config = {
  ...baseConfig,
  testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
};

export default config;
