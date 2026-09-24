import { Reflector } from '@nestjs/core';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { IS_PUBLIC_KEY } from '../../../src/auth/public.decorator';
import { StripeWebhookController } from '../../../src/billing/stripe-webhook.controller';
import type { BillingService } from '../../../src/billing/billing.service';

describe('StripeWebhookController', () => {
  it('verifies against the raw body, hands the event on, and acknowledges it', async () => {
    const event = { id: 'evt_1', type: 'customer.subscription.deleted' };
    const verifyWebhookEvent = jest.fn().mockReturnValue(event);
    const handleWebhookEvent = jest.fn().mockResolvedValue(undefined);
    const service = { verifyWebhookEvent, handleWebhookEvent } as unknown as BillingService;
    const controller = new StripeWebhookController(service);
    const rawBody = Buffer.from('{"id":"evt_1"}');
    const request = { rawBody, body: { id: 'evt_1' } } as unknown as RawBodyRequest<Request>;

    await expect(controller.handle(request, 't=1,v1=abc')).resolves.toEqual({ received: true });
    expect(verifyWebhookEvent).toHaveBeenCalledWith(rawBody, 't=1,v1=abc');
    expect(handleWebhookEvent).toHaveBeenCalledWith(event);
  });

  it('does not process anything when verification throws', async () => {
    const verifyWebhookEvent = jest.fn(() => {
      throw new Error('bad signature');
    });
    const handleWebhookEvent = jest.fn();
    const service = { verifyWebhookEvent, handleWebhookEvent } as unknown as BillingService;
    const controller = new StripeWebhookController(service);

    await expect(controller.handle({} as RawBodyRequest<Request>, undefined)).rejects.toThrow(
      'bad signature',
    );
    expect(handleWebhookEvent).not.toHaveBeenCalled();
  });

  it('is @Public(), because Stripe carries no JWT', () => {
    const reflector = new Reflector();

    expect(reflector.get<boolean>(IS_PUBLIC_KEY, StripeWebhookController.prototype.handle)).toBe(
      true,
    );
  });
});
