import { DynamicModule, Module } from '@nestjs/common';

import { ADMIN_DATABASE_URL, PrismaService } from './prisma.service';
import { APP_PRISMA_CLIENT, AppPrismaClient, DATABASE_URL } from './app-prisma.client';
import { TenantRunner } from './tenant-runner.service';

export interface DatabaseModuleTenantOptions {
  readonly databaseUrl: string;
}

export interface DatabaseModuleRootOptions extends DatabaseModuleTenantOptions {
  readonly adminDatabaseUrl: string;
}

/**
 * Two registrations, not one module with an option flag (TDD §3.10):
 *
 * - `forTenant()` — `apps/worker`. Registers `AppPrismaClient` and `TenantRunner` only.
 *   `PrismaService` is not a provider at all in this container, so injecting it anywhere in
 *   the worker is a startup-time DI error, not a runtime privilege escalation.
 * - `forRoot()` — `apps/api`. Registers both clients; `PrismaService` stays reachable only by
 *   the five callers enumerated in §3.2, enforced by the ESLint `no-restricted-imports` rule.
 *
 * `APP_PRISMA_CLIENT` is aliased to the same `AppPrismaClient` provider in both registrations —
 * `TenantRunner` depends on the token, not the class, so both containers resolve it to the one
 * instance already registered (see `tenant-runner.service.ts` for why the token exists).
 */
@Module({})
export class DatabaseModule {
  static forTenant(options: DatabaseModuleTenantOptions): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        { provide: DATABASE_URL, useValue: options.databaseUrl },
        AppPrismaClient,
        { provide: APP_PRISMA_CLIENT, useExisting: AppPrismaClient },
        TenantRunner,
      ],
      exports: [AppPrismaClient, TenantRunner],
    };
  }

  static forRoot(options: DatabaseModuleRootOptions): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        { provide: DATABASE_URL, useValue: options.databaseUrl },
        { provide: ADMIN_DATABASE_URL, useValue: options.adminDatabaseUrl },
        AppPrismaClient,
        { provide: APP_PRISMA_CLIENT, useExisting: AppPrismaClient },
        PrismaService,
        TenantRunner,
      ],
      exports: [AppPrismaClient, PrismaService, TenantRunner],
    };
  }
}
