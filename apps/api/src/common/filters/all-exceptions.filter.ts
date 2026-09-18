import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ERROR_CODES, type ErrorCode } from '@feedback-board/shared';
import { Logger } from 'nestjs-pino';

const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set(Object.values(ERROR_CODES));

function codeForStatus(status: number): ErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ERROR_CODES.VALIDATION_FAILED;
    case HttpStatus.UNAUTHORIZED:
      return ERROR_CODES.UNAUTHORIZED;
    case HttpStatus.FORBIDDEN:
      return ERROR_CODES.FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return ERROR_CODES.NOT_FOUND;
    case HttpStatus.CONFLICT:
      return ERROR_CODES.CONFLICT;
    case HttpStatus.TOO_MANY_REQUESTS:
      return ERROR_CODES.RATE_LIMITED;
    default:
      return ERROR_CODES.INTERNAL_ERROR;
  }
}

/**
 * Nest's own built-in exceptions (e.g. the 404 thrown for an unmatched route) already carry an
 * `error` string of their own — `'Not Found'`, `'Forbidden'` — which is English prose, not one of
 * our codes. Checking only "is `error` a string" would let that prose pass through untouched, so
 * this must confirm the value is actually a member of ERROR_CODES before treating the body as
 * already correctly shaped (TDD §7.8: the API emits codes, never sentences).
 */
function hasErrorCode(body: unknown): body is { error: ErrorCode } {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof Reflect.get(body, 'error') === 'string' &&
    KNOWN_ERROR_CODES.has(Reflect.get(body, 'error') as string)
  );
}

/**
 * The single place an HTTP error body is shaped. Anything already carrying a known `error` code —
 * `PlanGuard`'s `PLAN_LIMIT` payload, the validation factory's `fields` — passes through
 * untouched; everything else, including Nest's own default exception bodies, is reduced to its
 * code so no response ever carries prose (§7.8).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly logger: Logger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const response = host.switchToHttp().getResponse<unknown>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      httpAdapter.reply(
        response,
        hasErrorCode(body) ? body : { error: codeForStatus(status) },
        status,
      );
      return;
    }

    this.logger.error({ err: exception }, 'Unhandled exception');
    httpAdapter.reply(
      response,
      { error: ERROR_CODES.INTERNAL_ERROR },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
