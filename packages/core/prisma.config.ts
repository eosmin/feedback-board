import { resolve } from 'node:path';

import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Every `prisma` CLI invocation runs as `pnpm --filter @feedback-board/core exec prisma ...`
// (TDD §2.6.4), which sets cwd to this package, not the repo root — so the bare `dotenv/config`
// import used in Prisma's own generated file (which assumes .env sits beside prisma.config.ts)
// would miss the actual .env at the monorepo root (§16). Point it there explicitly instead.
config({ path: resolve(__dirname, '../../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
