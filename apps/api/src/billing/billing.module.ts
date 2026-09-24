import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { OrgsModule } from '../orgs/orgs.module';
import type { Env } from '../config/env.schema';
import { BillingController } from './billing.controller';
import { BILLING_OPTIONS, BillingService, STRIPE_CLIENT } from './billing.service';
import type { BillingOptions } from './billing.service';
import { StripeWebhookController } from './stripe-webhook.controller';

/**
 * Wiring only; every decision lives in `billing.service.ts`, which the coverage gate measures
 * (this file is excluded, §14.1). `OrgsModule` supplies the guard chain and
 * `TenantPrismaService`; `PrismaService` and `Logger` are global.
 */
@Module({
  imports: [OrgsModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [
    {
      provide: STRIPE_CLIENT,
      inject: [ConfigService],
      // Pinned to the version stripe@22.6.1 ships, so a dashboard default cannot change payload shapes.
      useFactory: (config: ConfigService<Env, true>): Stripe =>
        new Stripe(config.get('STRIPE_SECRET_KEY', { infer: true }), {
          apiVersion: '2026-08-26.dahlia',
        }),
    },
    {
      provide: BILLING_OPTIONS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): BillingOptions => ({
        proPriceId: config.get('STRIPE_PRO_PRICE_ID', { infer: true }),
        webOrigin: config.get('WEB_ORIGIN', { infer: true }),
        webhookSecret: config.get('STRIPE_WEBHOOK_SECRET', { infer: true }),
      }),
    },
    BillingService,
  ],
})
export class BillingModule {}
