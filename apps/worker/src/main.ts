import { NestFactory } from '@nestjs/core';
import { Logger } from '@feedback-board/core';

import { WorkerModule } from './worker.module';

/**
 * No HTTP adapter (TDD §3.10) — `createApplicationContext` boots the DI container only, with no
 * controllers, no guards, no CORS surface. `enableShutdownHooks()` is what makes `SIGTERM`
 * actually close the underlying BullMQ `Worker` instances (via their `onModuleDestroy`, wired by
 * `@nestjs/bullmq`) before the process exits — without it, a container restart during a deploy
 * kills a delivery mid-flight and the job is only recovered once its lock expires (§17).
 *
 * `bufferLogs: true` → `useLogger(app.get(Logger))` → `flushLogs()` is `nestjs-pino`'s own
 * documented pattern for a non-HTTP `createApplicationContext` app (TDD §2.6.16) — the same
 * three-call shape `apps/api/src/main.ts` uses, minus the HTTP-specific `pinoHttp`
 * request/response middleware, which never runs because there is no HTTP adapter to attach it
 * to.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  app.enableShutdownHooks();

  app.get(Logger).log('worker started, listening for jobs');
  app.flushLogs();
}

void bootstrap();
