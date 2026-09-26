import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
      // Thin @supabase/ssr wrappers, covered by the Playwright golden paths instead (TDD §14.1).
      exclude: ['**/*.d.ts', 'lib/supabase/**'],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
});
