import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { validationExceptionFactory } from '../../src/common/validation-exception.factory';
import { closeTestApp } from '../fixtures/close-test-app';

describe('health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: validationExceptionFactory,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    // AppModule imports OrgsModule as of Step 8, which registers redisConnectionProvider — see
    // closeTestApp's own doc comment for why app.close() alone is not enough here.
    await closeTestApp(app);
  });

  it('GET /health returns 200', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('answers an unknown route with a code, not prose', async () => {
    const response = await request(app.getHttpServer()).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'NOT_FOUND' });
  });
});
