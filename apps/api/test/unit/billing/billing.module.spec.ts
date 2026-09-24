import { Test } from '@nestjs/testing';
import { DatabaseModule, LoggerModule } from '@feedback-board/core';
import type { TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import type Stripe from 'stripe';

import { BillingModule } from '../../../src/billing/billing.module';
import { BillingController } from '../../../src/billing/billing.controller';
import { StripeWebhookController } from '../../../src/billing/stripe-webhook.controller';
import { BILLING_OPTIONS, STRIPE_CLIENT } from '../../../src/billing/billing.service';
import { REDIS_CONNECTION } from '../../../src/queue/redis.connection';
import { closeTestingModule } from '../../fixtures/close-testing-module';

describe('BillingModule', () => {
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    await closeTestingModule(moduleRef);
  });

  it('builds the Stripe client and options from config and resolves both controllers', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            (): Record<string, string> => ({
              STRIPE_SECRET_KEY: 'sk_test_unit',
              STRIPE_WEBHOOK_SECRET: 'whsec_unit',
              STRIPE_PRO_PRICE_ID: 'price_unit',
              WEB_ORIGIN: 'http://localhost:3000',
            }),
          ],
        }),
        LoggerModule.register({ isProduction: true }),
        DatabaseModule.forRoot({
          databaseUrl: 'postgresql://app:pw@localhost:5432/postgres',
          adminDatabaseUrl: 'postgresql://owner:pw@localhost:5432/postgres',
        }),
        BillingModule,
      ],
    })
      // Same override as orgs.module.spec.ts: DI wiring only, no real Redis connection.
      .overrideProvider(REDIS_CONNECTION)
      .useValue({})
      .compile();

    // Pinned, so a Stripe dashboard default cannot silently change payload shapes (§2.6.7).
    expect(moduleRef.get<Stripe>(STRIPE_CLIENT).getApiField('version')).toBe('2026-08-26.dahlia');
    expect(moduleRef.get(BILLING_OPTIONS)).toEqual({
      proPriceId: 'price_unit',
      webOrigin: 'http://localhost:3000',
      webhookSecret: 'whsec_unit',
    });
    // Both controllers inherit request scope from TenantPrismaService, so resolve(), not get().
    await expect(moduleRef.resolve(BillingController)).resolves.toBeInstanceOf(BillingController);
    await expect(moduleRef.resolve(StripeWebhookController)).resolves.toBeInstanceOf(
      StripeWebhookController,
    );
  });
});
