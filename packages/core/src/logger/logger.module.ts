import { DynamicModule, Module } from '@nestjs/common';
import { LoggerModule as NestjsPinoLoggerModule } from 'nestjs-pino';

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["stripe-signature"]',
] as const;

/**
 * `isProduction` arrives already computed from the caller's own validated env (TDD §2.2a:
 * `packages/core` reads no `process.env` of its own) — the same shape as `AiTransportConfig`
 * for `AiModule.register()`.
 */
export interface LoggerOptions {
  readonly isProduction: boolean;
}

/**
 * A dynamic registration in the same shape as `AiModule.register()` (TDD §3.10, §2.6.16):
 * `apps/api` and `apps/worker` both import `LoggerModule`/`Logger`/`PinoLogger` re-exported from
 * `@feedback-board/core` instead of declaring `nestjs-pino`/`pino`/`pino-http`/`pino-pretty` as
 * their own direct dependencies. `pinoHttp` is the single key `nestjs-pino`'s `Params` exposes
 * for pino's own options regardless of whether an HTTP adapter is present — `apps/worker` boots
 * with `NestFactory.createApplicationContext`, so the request/response middleware `pino-http`
 * would normally attach to Express never gets wired up there, but the same `level`/`redact`
 * options still configure the underlying pino instance `PinoLogger` writes through.
 *
 * `.forRoot()`, not `.forRootAsync()`: unlike `BullModule.forRootAsync` in `queue.module.ts`,
 * there is no async DI token to resolve here — `options` already arrives as a plain,
 * fully-resolved value from the caller, so a synchronous factory is the simpler call (§7.3).
 */
@Module({})
export class LoggerModule {
  static register(options: LoggerOptions): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        NestjsPinoLoggerModule.forRoot({
          pinoHttp: {
            level: options.isProduction ? 'info' : 'debug',
            ...(!options.isProduction && {
              transport: {
                target: 'pino-pretty',
                options: { colorize: true, singleLine: true },
              },
            }),
            redact: [...REDACTED_PATHS],
          },
        }),
      ],
      exports: [NestjsPinoLoggerModule],
    };
  }
}
