import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet } from 'jose';

import { jwksProvider, jwtIssuerProvider } from '../../../src/auth/jwks.provider';
import type { Env } from '../../../src/config/env.schema';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn().mockReturnValue('jwks-resolver'),
}));

function buildConfig(supabaseUrl: string): ConfigService<Env, true> {
  return { get: () => supabaseUrl } as unknown as ConfigService<Env, true>;
}

describe('jwksProvider', () => {
  it('builds a remote JWKS resolver from SUPABASE_URL, not process.env directly', () => {
    const config = buildConfig('http://127.0.0.1:54321');

    const resolver = jwksProvider.useFactory(config);

    expect(createRemoteJWKSet).toHaveBeenCalledWith(
      new URL('http://127.0.0.1:54321/auth/v1/.well-known/jwks.json'),
    );
    expect(resolver).toBe('jwks-resolver');
  });
});

describe('jwtIssuerProvider', () => {
  it('derives the issuer URL from SUPABASE_URL', () => {
    const config = buildConfig('http://127.0.0.1:54321');

    const issuer = jwtIssuerProvider.useFactory(config);

    expect(issuer).toBe('http://127.0.0.1:54321/auth/v1');
  });
});
