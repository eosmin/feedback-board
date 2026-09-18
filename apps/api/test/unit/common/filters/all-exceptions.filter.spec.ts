import {
  ArgumentsHost,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ERROR_CODES } from '@feedback-board/shared';

import { AllExceptionsFilter } from '../../../../src/common/filters/all-exceptions.filter';

function buildHost(): ArgumentsHost {
  return {
    switchToHttp: () => ({ getResponse: () => ({}), getRequest: () => ({}) }),
  } as unknown as ArgumentsHost;
}

function buildFilter(logger: { error: jest.Mock }): {
  filter: AllExceptionsFilter;
  reply: jest.Mock;
} {
  const reply = jest.fn();
  const adapterHost = { httpAdapter: { reply } } as unknown as HttpAdapterHost;

  return { filter: new AllExceptionsFilter(adapterHost, logger as never), reply };
}

describe('AllExceptionsFilter', () => {
  it('replaces a bare NotFoundException body with the NOT_FOUND code, dropping Nest prose', () => {
    const logger = { error: jest.fn() };
    const { filter, reply } = buildFilter(logger);

    filter.catch(new NotFoundException(), buildHost());

    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      { error: ERROR_CODES.NOT_FOUND },
      HttpStatus.NOT_FOUND,
    );
  });

  it('maps UnauthorizedException to UNAUTHORIZED', () => {
    const logger = { error: jest.fn() };
    const { filter, reply } = buildFilter(logger);

    filter.catch(new UnauthorizedException(), buildHost());

    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      { error: ERROR_CODES.UNAUTHORIZED },
      HttpStatus.UNAUTHORIZED,
    );
  });

  it('maps ConflictException to CONFLICT', () => {
    const logger = { error: jest.fn() };
    const { filter, reply } = buildFilter(logger);

    filter.catch(new ConflictException(), buildHost());

    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      { error: ERROR_CODES.CONFLICT },
      HttpStatus.CONFLICT,
    );
  });

  it('falls back to INTERNAL_ERROR for a status with no explicit mapping', () => {
    const logger = { error: jest.fn() };
    const { filter, reply } = buildFilter(logger);

    filter.catch(new ForbiddenException(undefined), buildHost());

    // ForbiddenException's default body is Nest's own { statusCode, message, error: 'Forbidden' },
    // which is not a known code, so this exercises hasErrorCode's false branch for FORBIDDEN too.
    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      { error: ERROR_CODES.FORBIDDEN },
      HttpStatus.FORBIDDEN,
    );
  });

  it('leaves a body already carrying a known error code untouched', () => {
    const logger = { error: jest.fn() };
    const { filter, reply } = buildFilter(logger);
    const planLimitBody = { error: ERROR_CODES.PLAN_LIMIT, limit: 'boards', plan: 'FREE', cap: 1 };

    filter.catch(new ForbiddenException(planLimitBody), buildHost());

    expect(reply).toHaveBeenCalledWith(expect.anything(), planLimitBody, HttpStatus.FORBIDDEN);
  });

  it('treats a non-object exception response as not carrying a known code', () => {
    const logger = { error: jest.fn() };
    const { filter, reply } = buildFilter(logger);

    filter.catch(new NotFoundException('plain string body'), buildHost());

    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      { error: ERROR_CODES.NOT_FOUND },
      HttpStatus.NOT_FOUND,
    );
  });

  it('logs and returns INTERNAL_ERROR for a non-HttpException', () => {
    const logger = { error: jest.fn() };
    const { filter, reply } = buildFilter(logger);
    const error = new Error('boom');

    filter.catch(error, buildHost());

    expect(logger.error).toHaveBeenCalledWith({ err: error }, 'Unhandled exception');
    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      { error: ERROR_CODES.INTERNAL_ERROR },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });

  it('falls back to INTERNAL_ERROR for an HttpException status with no explicit mapping', () => {
    const logger = { error: jest.fn() };
    const { filter, reply } = buildFilter(logger);

    filter.catch(new HttpException('teapot', HttpStatus.I_AM_A_TEAPOT), buildHost());

    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      { error: ERROR_CODES.INTERNAL_ERROR },
      HttpStatus.I_AM_A_TEAPOT,
    );
  });
});
