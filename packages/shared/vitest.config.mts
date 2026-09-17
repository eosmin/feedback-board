import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    coverage: {
      // Enabled in the config, not left to a `--coverage` flag on the command line: the root
      // fan-out and the pre-push hook both run a bare `pnpm test`, and with coverage off by
      // default the thresholds below would be evaluated by nothing (TDD §14.1 — a threshold
      // that only runs when someone remembers a flag is not a gate).
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // A hard gate: the build fails below these numbers, and they are never lowered to go
      // green (TDD §14.1).
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
