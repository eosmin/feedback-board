import { Controller, Headers, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../auth/public.decorator';
import { BillingService } from './billing.service';
import type { BillingService as Billing } from './billing.service';

/**
 * The fourth and last `@Public()` route (TDD §11): Stripe carries no JWT, so the signature over
 * the raw body is the only authentication. Answers 200 for any verified event, including ones
 * this app ignores and ones it already processed — a non-2xx makes Stripe retry, which is
 * reserved for real failures.
 */
@ApiExcludeController()
@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(@Inject(BillingService) private readonly billing: Billing) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): globalThis.Promise<{ received: true }> {
    const event = this.billing.verifyWebhookEvent(request.rawBody, signature);
    await this.billing.handleWebhookEvent(event);
    return { received: true };
  }
}
