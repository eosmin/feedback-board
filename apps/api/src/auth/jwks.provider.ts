import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';

import type { Env } from '../config/env.schema';

export const JWKS = Symbol('JWKS');
export const JWT_ISSUER = Symbol('JWT_ISSUER');

/**
 * `createRemoteJWKSet` caches keys and rate-limits refetches internally, so the instance must
 * be a singleton — constructing it per request defeats that caching entirely (TDD §2.6.8).
 * `JwtAuthGuard` verifies every request against this one resolver.
 */
export const jwksProvider = {
  provide: JWKS,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): JWTVerifyGetKey => {
    const supabaseUrl = config.get('SUPABASE_URL', { infer: true });
    return createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  },
};

export const jwtIssuerProvider = {
  provide: JWT_ISSUER,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): string => {
    const supabaseUrl = config.get('SUPABASE_URL', { infer: true });
    return `${supabaseUrl}/auth/v1`;
  },
};
