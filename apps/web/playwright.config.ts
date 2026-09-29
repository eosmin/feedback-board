import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the two golden-path suites (TDD §14, §14.1, Step 19.6). `test:e2e`
 * (`pnpm --filter web test:e2e`) must run against a **built** app, not `next dev` — the `webServer`
 * command below builds then starts, matching the "Done when" of this step and mirroring how
 * `web.yml` (Step 20.2) will invoke it in CI. Coverage from this suite is never counted toward
 * §14.1's thresholds; it proves the two flows work end to end.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: process.env.WEB_E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm build && pnpm start',
    // Health-check `/login`, not the base URL: there is no `app/page.tsx` at `/` (TDD §12's
    // route table has no root route), so a check against `/` gets a 404 and Playwright never
    // recognizes the server as ready — it then tries to start a second one and collides with
    // the first on `EADDRINUSE` instead of reusing it.
    url: `${process.env.WEB_E2E_BASE_URL ?? 'http://localhost:3000'}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
