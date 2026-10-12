import { resolve } from 'node:path';

import { config } from 'dotenv';

import { runSeed } from './seed';
import { AppPrismaClient } from '../../src/database/app-prisma.client';
import { PrismaService } from '../../src/database/prisma.service';
import { TenantRunner } from '../../src/database/tenant-runner.service';

// Same reason as prisma.config.ts: `pnpm --filter` runs with this package as cwd, so the
// monorepo-root .env has to be pointed at explicitly.
config({ path: resolve(__dirname, '../../../../.env') });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`seed: ${name} is not set`);
  }
  return value;
}

const ALLOWED_NODE_ENVS: readonly string[] = ['development', 'test'];
const LOCAL_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '[::1]', 'host.docker.internal'];

function assertLocalDatabase(name: string, value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`seed: ${name} is not a valid URL`);
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error(`seed: ${name} must be a postgres:// or postgresql:// URL`);
  }
  // `pg` lets a `host` query parameter override the URL's own host, and a comma-separated
  // authority lists several hosts: both would slip past a check on `hostname` alone.
  if (url.searchParams.has('host') || url.searchParams.has('hostaddr') || value.includes(',')) {
    throw new Error(`seed: ${name} must name a single host in the URL itself`);
  }
  // Node keeps the brackets on IPv6 hostnames; tolerate either form.
  if (!LOCAL_HOSTS.includes(url.hostname) && !LOCAL_HOSTS.includes(`[${url.hostname}]`)) {
    throw new Error(`seed: ${name} points at "${url.hostname}", which is not a local database`);
  }
}

async function main(): Promise<void> {
  if (!ALLOWED_NODE_ENVS.includes(process.env.NODE_ENV ?? '')) {
    throw new Error(
      `seed: NODE_ENV must be one of ${ALLOWED_NODE_ENVS.join(', ')} (got "${process.env.NODE_ENV ?? ''}"); set it in .env (see .env.example) or the command line`,
    );
  }

  const adminUrl = requireEnv('ADMIN_DATABASE_URL');
  const appUrl = requireEnv('DATABASE_URL');
  assertLocalDatabase('ADMIN_DATABASE_URL', adminUrl);
  assertLocalDatabase('DATABASE_URL', appUrl);

  const ownerEmail = process.env.SEED_OWNER_EMAIL?.trim() || undefined;

  let admin: PrismaService | undefined;
  let app: AppPrismaClient | undefined;
  try {
    admin = new PrismaService(adminUrl);
    app = new AppPrismaClient(appUrl);
    const summary = await runSeed({ admin, runner: new TenantRunner(app), ownerEmail });
    process.stdout.write(`seed: done ${JSON.stringify(summary)}\n`);
    if (ownerEmail && !summary.ownerFound) {
      process.stderr.write(
        `seed: no user with email ${ownerEmail}: check the spelling, or sign in once first\n`,
      );
      // The demo data is in place, but the requested owner is not: do not report success.
      process.exitCode = 1;
    }
  } finally {
    // allSettled: one failing close must neither skip the other nor mask the seed's own error,
    // but it is still worth reporting.
    const closed = await Promise.allSettled([admin?.onModuleDestroy(), app?.onModuleDestroy()]);
    for (const result of closed) {
      if (result.status === 'rejected') {
        process.stderr.write(`seed: failed to close a connection: ${String(result.reason)}\n`);
      }
    }
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.stderr.write('seed: failed; it is idempotent, fix the cause and run it again\n');
  process.exitCode = 1;
});
