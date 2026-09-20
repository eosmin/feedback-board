import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';

import { JwtAuthGuard } from '../../../src/auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../../src/database/tenant-prisma.service';

jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
}));

const mockedJwtVerify = jwtVerify as jest.MockedFunction<typeof jwtVerify>;

function buildContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => (): void => {},
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function buildReflector(isPublic: boolean | undefined): Reflector {
  return { getAllAndOverride: () => isPublic } as unknown as Reflector;
}

describe('JwtAuthGuard', () => {
  // Cast to the exact type JwtAuthGuard's constructor declares (JWTVerifyGetKey), not to
  // `Parameters<typeof jwtVerify>[1]` — jwtVerify is overloaded, and that expression picks its
  // widest overload (`KeyInput | JWTVerifyGetKey`), which is not assignable back to the
  // guard's narrower parameter type.
  const jwks = 'jwks-resolver' as unknown as JWTVerifyGetKey;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('allows a @Public() route through without checking the token', async () => {
    const guard = new JwtAuthGuard(buildReflector(true), jwks, 'http://issuer/auth/v1');
    const context = buildContext({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(mockedJwtVerify).not.toHaveBeenCalled();
  });

  it('rejects a request with no Authorization header', async () => {
    const guard = new JwtAuthGuard(buildReflector(false), jwks, 'http://issuer/auth/v1');
    const context = buildContext({ headers: {} } as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a malformed Authorization header', async () => {
    const guard = new JwtAuthGuard(buildReflector(false), jwks, 'http://issuer/auth/v1');
    const context = buildContext({ headers: { authorization: 'Basic abc' } } as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches userId and userEmail from a valid token payload', async () => {
    mockedJwtVerify.mockResolvedValue({
      payload: { sub: 'user-1', email: 'user@example.com' },
    } as never);
    const guard = new JwtAuthGuard(buildReflector(false), jwks, 'http://issuer/auth/v1');
    const request = { headers: { authorization: 'Bearer good-token' } } as AuthenticatedRequest;
    const context = buildContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.userId).toBe('user-1');
    expect(request.userEmail).toBe('user@example.com');
  });

  it('rejects a token whose payload has no subject', async () => {
    mockedJwtVerify.mockResolvedValue({ payload: {} } as never);
    const guard = new JwtAuthGuard(buildReflector(false), jwks, 'http://issuer/auth/v1');
    const context = buildContext({
      headers: { authorization: 'Bearer bad-token' },
    } as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid or expired token', async () => {
    mockedJwtVerify.mockRejectedValue(new Error('signature verification failed'));
    const guard = new JwtAuthGuard(buildReflector(false), jwks, 'http://issuer/auth/v1');
    const context = buildContext({
      headers: { authorization: 'Bearer expired-token' },
    } as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
