import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { jwksProvider, jwtIssuerProvider } from './jwks.provider';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Registers `JwtAuthGuard` globally via `APP_GUARD` (TDD §3.4) — every route requires a valid
 * Supabase JWT unless annotated `@Public()`. `JWKS`/`JWT_ISSUER` are exported so
 * `BullBoardModule` (Step 15) can import this module and verify a token with the exact same
 * resolver, rather than constructing a second `createRemoteJWKSet` singleton against the same
 * endpoint (§2.6.8's own note on why that instance must stay a singleton).
 */
@Module({
  providers: [jwksProvider, jwtIssuerProvider, { provide: APP_GUARD, useClass: JwtAuthGuard }],
  exports: [jwksProvider, jwtIssuerProvider],
})
export class AuthModule {}
