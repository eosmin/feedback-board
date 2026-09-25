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
import { BillingModule } from './billing/billing.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { BullBoardModule } from './queue/bull-board.module';

// Importing ConfigModule (above) triggers config.module.ts's own module-load-time call to
// NestConfigModule.forRoot(...), which loads the root .env file synchronously as a side effect
// before this line runs — so process.env is already populated here. DatabaseModule.forRoot
// takes literal connection strings (TDD §2.6.4, §3.10: packages/core reads no process.env of
// its own), so this app validates its own environment once, eagerly, to supply them; Nest's own
// ConfigModule.validate then re-runs the identical check during normal DI bootstrap.
//
// AiModule is NOT registered here: the digest is BoardsModule's own feature (TDD §3.8's second
// flow), and AiService holds no shared resource worth hoisting to the root module (the same
// reasoning packages/core/src/ai/ai.module.ts's own docstring gives for not marking it global)
// — BoardsModule builds its AiService from a ConfigService-injected factory instead, so a
// boards-only test tree never needs this app's full env (§7.1).
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
    BillingModule,
    WebhooksModule,
    // Registered last (§8 step 15): it inspects queues (QueueModule) and verifies JWTs
    // (AuthModule), both of which must already be wired. Its own register() reads the flag
    // once, eagerly, and returns an empty DynamicModule when disabled — the route does not
    // exist at all rather than existing and refusing every request (§3.10, decision D6).
    BullBoardModule.register({ enabled: env.BULL_BOARD_ENABLED }),
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
