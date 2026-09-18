import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { validateEnv } from './env.schema';

/**
 * `@nestjs/config` merges the env file into `process.env` and hands the result to `validate`,
 * so a missing or malformed variable aborts the boot instead of surfacing as `undefined` later.
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
      validate: validateEnv,
    }),
  ],
})
export class ConfigModule {}
