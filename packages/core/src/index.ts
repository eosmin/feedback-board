export * from './constants/queues';

export * from './schemas/jobs';
export * from './schemas/ai';

export * from './database/prisma.service';
export * from './database/app-prisma.client';
export * from './database/tenant-runner.service';
export * from './database/database.module';
export * from './database/is-uuid';

export * from './ai/resolve-model';
export * from './ai/ai.service';
export * from './ai/ai.module';

export * from './logger/logger.module';
// `nestjs-pino`'s own classes, not re-implemented ones (TDD §2.6.16) — `apps/api` and
// `apps/worker` inject `Logger`/`PinoLogger` from this barrel instead of declaring
// `nestjs-pino` as their own direct dependency.
export { Logger, PinoLogger } from 'nestjs-pino';

// A value export, not `export type`: `Prisma` is a namespace carrying both types
// (`Prisma.TransactionClient`, used by TenantRunner/TenantPrismaService) and runtime values
// (`Prisma.PrismaClientKnownRequestError`, used by BoardsService to distinguish a unique-
// constraint violation from any other database error, TDD §10). `export type` erases the value
// at compile time, which left every consumer of the value crashing with
// "Cannot read properties of undefined" the moment one existed.
export { Prisma } from './generated/prisma/client';
