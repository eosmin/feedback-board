import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';

import { LoggerModule } from '../../../src/logger/logger.module';

describe('LoggerModule.register', () => {
  it('registers a usable Logger with the production transport (no pino-pretty)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.register({ isProduction: true })],
    }).compile();

    expect(moduleRef.get(Logger)).toBeInstanceOf(Logger);
  });

  it('registers a usable Logger with the dev pino-pretty transport', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.register({ isProduction: false })],
    }).compile();

    expect(moduleRef.get(Logger)).toBeInstanceOf(Logger);
  });
});
