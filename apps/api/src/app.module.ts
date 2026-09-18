import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConfigModule } from './config/config.module';
import type { Env } from './config/env.schema';
import { HealthController } from './health/health.controller';

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
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
