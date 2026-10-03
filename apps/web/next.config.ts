import { resolve } from 'node:path';

import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  // No `/[locale]` segment exists in this app (TDD §2.6.13) — the plugin only wires the
  // request-config lookup, it does not add routing.
  // Opt-in, set only by apps/web/Dockerfile: `next start` (used by the Playwright suites and
  // `pnpm start`) does not work against a standalone build, so it cannot be unconditional.
  ...(process.env.NEXT_OUTPUT === 'standalone' && {
    output: 'standalone',
    // Inside a pnpm workspace the traced files (`@feedback-board/shared`, hoisted
    // `node_modules`) live above apps/web; without the repo root as tracing root they are left
    // out of the standalone bundle and the container fails at runtime, not at build.
    outputFileTracingRoot: resolve(__dirname, '../..'),
  }),
};

const withNextIntl = createNextIntlPlugin({
  experimental: { createMessagesDeclaration: './messages/en.json' },
});

export default withNextIntl(nextConfig);
