import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { jwksProvider, jwtIssuerProvider } from './jwks.provider';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Registers `JwtAuthGuard` globally via `APP_GUARD` (TDD §3.4) — every route requires a valid
 * Supabase JWT unless annotated `@Public()`.
 */
@Module({
  providers: [jwksProvider, jwtIssuerProvider, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AuthModule {}
