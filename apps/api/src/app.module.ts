import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { DatabaseModule } from '@feedback-board/core';
import { LoggerModule } from 'nestjs-pino';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConfigModule } from './config/config.module';
import { validateEnv } from './config/env.schema';
import type { Env } from './config/env.schema';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';

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
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            ...(!isProduction && {
              transport: {
                target: 'pino-pretty',
                options: { colorize: true, singleLine: true },
              },
            }),
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["stripe-signature"]',
            ],
          },
        };
      },
    }),
    DatabaseModule.forRoot({
      databaseUrl: env.DATABASE_URL,
      adminDatabaseUrl: env.ADMIN_DATABASE_URL,
    }),
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
