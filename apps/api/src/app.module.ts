import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DatabaseModule, LoggerModule } from '@feedback-board/core';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConfigModule } from './config/config.module';
import { validateEnv } from './config/env.schema';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { OrgsModule } from './orgs/orgs.module';
import { BoardsModule } from './boards/boards.module';
import { PostsModule } from './posts/posts.module';
import { PublicModule } from './public/public.module';

// Importing ConfigModule (above) triggers config.module.ts's own module-load-time call to
// NestConfigModule.forRoot(...), which loads the root .env file synchronously as a side effect
// before this line runs — so process.env is already populated here. DatabaseModule.forRoot
// takes literal connection strings (TDD §2.6.4, §3.10: packages/core reads no process.env of
// its own), so this app validates its own environment once, eagerly, to supply them; Nest's own
// ConfigModule.validate then re-runs the identical check during normal DI bootstrap.
const env = validateEnv(process.env);

@Module({
  imports: [
    ConfigModule,
    // LoggerModule.register() (TDD §2.6.16) wraps nestjs-pino's own LoggerModule.forRoot() —
    // this app declares no nestjs-pino/pino/pino-http/pino-pretty dependency of its own, the
    // options object it needs is just a boolean this app already computed from its validated
    // env (§2.2a's rule applies here exactly as it does to DatabaseModule/AiModule).
    LoggerModule.register({ isProduction: env.NODE_ENV === 'production' }),
    DatabaseModule.forRoot({
      databaseUrl: env.DATABASE_URL,
      adminDatabaseUrl: env.ADMIN_DATABASE_URL,
    }),
    AuthModule,
    OrgsModule,
    BoardsModule,
    PostsModule,
    PublicModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
