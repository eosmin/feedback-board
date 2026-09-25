import { ConfigService } from '@nestjs/config';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { Request, Response } from 'express';

import { createBullBoardGate } from '../../../src/queue/bull-board.middleware';
import type { Env } from '../../../src/config/env.schema';

jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
}));

const mockedJwtVerify = jwtVerify as jest.MockedFunction<typeof jwtVerify>;

function buildConfig(allowlist: string): ConfigService<Env, true> {
  return { get: () => allowlist } as unknown as ConfigService<Env, true>;
}

function buildRequest(authorization?: string): Request {
  return { headers: authorization === undefined ? {} : { authorization } } as unknown as Request;
}

function buildResponse(): { res: Response; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status } as unknown as Response, status, json };
}

describe('createBullBoardGate', () => {
  const jwks = 'jwks-resolver' as unknown as JWTVerifyGetKey;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('answers 401 for a request with no Authorization header, without calling next()', async () => {
    const gate = createBullBoardGate({
      config: buildConfig(''),
      jwks,
      issuer: 'http://issuer/auth/v1',
    });
    const { res, status, json } = buildResponse();
    const next = jest.fn();

    await gate(buildRequest(), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'UNAUTHORIZED' });
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 401 for a token that fails JWKS verification', async () => {
    mockedJwtVerify.mockRejectedValue(new Error('signature verification failed'));
    const gate = createBullBoardGate({
      config: buildConfig(''),
      jwks,
      issuer: 'http://issuer/auth/v1',
    });
    const { res, status, json } = buildResponse();
    const next = jest.fn();

    await gate(buildRequest('Bearer bad-token'), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'UNAUTHORIZED' });
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 403 for a valid token whose email is absent from the allowlist', async () => {
    mockedJwtVerify.mockResolvedValue({ payload: { email: 'stranger@example.com' } } as never);
    const gate = createBullBoardGate({
      config: buildConfig('admin@example.com'),
      jwks,
      issuer: 'http://issuer/auth/v1',
    });
    const { res, status, json } = buildResponse();
    const next = jest.fn();

    await gate(buildRequest('Bearer good-token'), res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'FORBIDDEN' });
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 403 when the allowlist is empty — empty means nobody, not everybody', async () => {
    mockedJwtVerify.mockResolvedValue({ payload: { email: 'admin@example.com' } } as never);
    const gate = createBullBoardGate({
      config: buildConfig(''),
      jwks,
      issuer: 'http://issuer/auth/v1',
    });
    const { res, status, json } = buildResponse();
    const next = jest.fn();

    await gate(buildRequest('Bearer good-token'), res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'FORBIDDEN' });
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 403 for a token with no email claim at all', async () => {
    mockedJwtVerify.mockResolvedValue({ payload: {} } as never);
    const gate = createBullBoardGate({
      config: buildConfig('admin@example.com'),
      jwks,
      issuer: 'http://issuer/auth/v1',
    });
    const { res, status, json } = buildResponse();
    const next = jest.fn();

    await gate(buildRequest('Bearer good-token'), res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'FORBIDDEN' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for a valid token whose email is in the allowlist', async () => {
    mockedJwtVerify.mockResolvedValue({ payload: { email: 'admin@example.com' } } as never);
    const gate = createBullBoardGate({
      config: buildConfig('other@example.com, admin@example.com'),
      jwks,
      issuer: 'http://issuer/auth/v1',
    });
    const { res, status } = buildResponse();
    const next = jest.fn();

    await gate(buildRequest('Bearer good-token'), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });
});
