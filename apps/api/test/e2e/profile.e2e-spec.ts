import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { bootstrapTestApp } from '../fixtures/bootstrap-test-app';
import { closeTestApp } from '../fixtures/close-test-app';
import { signInAs } from '../fixtures/sign-in';

// signInAs polls the local Mailpit mailbox for up to 15s (sign-in.ts).
const SIGN_IN_TEST_TIMEOUT_MS = 20_000;

const RUN_ID = randomUUID().slice(0, 8);
const email = (name: string): string => `profile-e2e-${RUN_ID}-${name}@example.com`;

describe('profile (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = await bootstrapTestApp(moduleRef);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it(
    'starts with no name, saves a trimmed one, and reads it back',
    async () => {
      const token = await signInAs(email('owner'));

      const before = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${token}`);
      expect(before.status).toBe(200);
      expect(before.body).toMatchObject({ email: email('owner'), name: null });

      const updated = await request(app.getHttpServer())
        .patch('/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '  Ada Lovelace  ' });
      expect(updated.status).toBe(200);
      expect(updated.body).toMatchObject({ email: email('owner'), name: 'Ada Lovelace' });

      const after = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${token}`);
      expect(after.body.name).toBe('Ada Lovelace');
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );

  it(
    "changes only the caller's own row, even if the body names another user",
    async () => {
      const tokenA = await signInAs(email('a'));
      const tokenB = await signInAs(email('b'));
      const b = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${tokenB}`);

      await request(app.getHttpServer())
        .patch('/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Only A', id: b.body.id, email: email('b') });

      const bAfter = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(bAfter.body.name).toBeNull();
    },
    SIGN_IN_TEST_TIMEOUT_MS * 2,
  );

  it(
    'refuses a blank or oversized name',
    async () => {
      const token = await signInAs(email('invalid'));

      for (const name of ['   ', 'a'.repeat(81)]) {
        const response = await request(app.getHttpServer())
          .patch('/me')
          .set('Authorization', `Bearer ${token}`)
          .send({ name });
        expect(response.status).toBe(400);
      }
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );

  it('rejects an unauthenticated request', async () => {
    const response = await request(app.getHttpServer()).get('/me');

    expect(response.status).toBe(401);
  });
});
