import { UnrecoverableError } from 'bullmq';
import type { Job } from 'bullmq';
import type { PinoLogger, TenantRunner, WebhookDeliveryService } from '@feedback-board/core';

import { WebhookDeliveryProcessor } from '../../../src/processors/webhook-delivery.processor';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const WEBHOOK_ID = '22222222-2222-4222-8222-222222222222';
const POST_ID = '33333333-3333-4333-8333-333333333333';

function buildRunner(overrides: {
  findFirstWebhook?: jest.Mock;
  findFirstPost?: jest.Mock;
  createDelivery?: jest.Mock;
}): { runner: TenantRunner; runAs: jest.Mock } {
  const runAs = jest.fn(async (_orgId: string, fn: (tx: unknown) => unknown) => {
    const tx = {
      webhook: { findFirst: overrides.findFirstWebhook ?? jest.fn() },
      post: { findFirst: overrides.findFirstPost ?? jest.fn() },
      webhookDelivery: { create: overrides.createDelivery ?? jest.fn() },
    };
    return fn(tx);
  });
  return { runner: { runAs } as unknown as TenantRunner, runAs };
}

/**
 * `runInContext` runs its callback inside an `AsyncLocalStorage` context in the real
 * `nestjs-pino` implementation (TDD §2.6.16) — this mock must actually invoke and await `fn`,
 * matching the same pattern `ai-classify.processor.spec.ts` uses.
 */
function buildLogger(): { logger: PinoLogger; warn: jest.Mock; runInContext: jest.Mock } {
  const warn = jest.fn();
  const setContext = jest.fn();
  const runInContext = jest.fn(
    async (fn: () => Promise<void>, _options: { bindings: Record<string, unknown> }) => fn(),
  );
  const logger = { warn, setContext, runInContext } as unknown as PinoLogger;
  return { logger, warn, runInContext };
}

function buildJob(data: unknown, attemptsMade = 0): Job {
  return { id: 'job-1', data, attemptsMade } as Job;
}

describe('WebhookDeliveryProcessor', () => {
  it('sets the PinoLogger context to its own class name on construction', () => {
    const { runner } = buildRunner({});
    const delivery = { deliver: jest.fn() } as unknown as WebhookDeliveryService;
    const { logger } = buildLogger();

    new WebhookDeliveryProcessor(runner, delivery, logger);

    expect(logger.setContext).toHaveBeenCalledWith('WebhookDeliveryProcessor');
  });

  it('runs the job inside a PinoLogger context bound to the queue and job id', async () => {
    const findFirstWebhook = jest.fn().mockResolvedValue(null);
    const { runner } = buildRunner({ findFirstWebhook });
    const delivery = { deliver: jest.fn() } as unknown as WebhookDeliveryService;
    const { logger, runInContext } = buildLogger();
    const processor = new WebhookDeliveryProcessor(runner, delivery, logger);

    await processor.process(
      buildJob({ orgId: ORG_ID, webhookId: WEBHOOK_ID, event: 'post.created', postId: POST_ID }),
    );

    expect(runInContext).toHaveBeenCalledWith(expect.any(Function), {
      bindings: { queue: 'webhooks', jobId: 'job-1' },
    });
  });

  it('throws UnrecoverableError and never opens a transaction when the payload fails validation', async () => {
    const { runner, runAs } = buildRunner({});
    const delivery = { deliver: jest.fn() } as unknown as WebhookDeliveryService;
    const { logger } = buildLogger();
    const processor = new WebhookDeliveryProcessor(runner, delivery, logger);

    await expect(processor.process(buildJob({ orgId: 'not-a-uuid' }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(runAs).not.toHaveBeenCalled();
  });

  it('completes without delivering or writing a row when the webhook is deleted or deactivated', async () => {
    const findFirstWebhook = jest.fn().mockResolvedValue(null);
    const createDelivery = jest.fn();
    const { runner } = buildRunner({ findFirstWebhook, createDelivery });
    const deliver = jest.fn();
    const delivery = { deliver } as unknown as WebhookDeliveryService;
    const { logger, warn } = buildLogger();
    const processor = new WebhookDeliveryProcessor(runner, delivery, logger);

    await processor.process(
      buildJob({ orgId: ORG_ID, webhookId: WEBHOOK_ID, event: 'post.created', postId: POST_ID }),
    );

    expect(findFirstWebhook).toHaveBeenCalledWith({
      where: { id: WEBHOOK_ID, isActive: true, events: { has: 'post.created' } },
      select: { id: true, targetUrl: true, secret: true },
    });
    expect(deliver).not.toHaveBeenCalled();
    expect(createDelivery).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      `deliver: webhook ${WEBHOOK_ID} no longer active/subscribed, skipping`,
    );
  });

  it('skips delivery and logs when the post no longer exists under the org', async () => {
    const findFirstWebhook = jest
      .fn()
      .mockResolvedValue({ id: WEBHOOK_ID, targetUrl: 'https://example.com', secret: 's' });
    const findFirstPost = jest.fn().mockResolvedValue(null);
    const createDelivery = jest.fn();
    const { runner } = buildRunner({ findFirstWebhook, findFirstPost, createDelivery });
    const deliver = jest.fn();
    const delivery = { deliver } as unknown as WebhookDeliveryService;
    const { logger, warn } = buildLogger();
    const processor = new WebhookDeliveryProcessor(runner, delivery, logger);

    await processor.process(
      buildJob({ orgId: ORG_ID, webhookId: WEBHOOK_ID, event: 'post.created', postId: POST_ID }),
    );

    expect(deliver).not.toHaveBeenCalled();
    expect(createDelivery).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      `deliver: post ${POST_ID} not found in org ${ORG_ID}, skipping`,
    );
  });

  it('writes one WebhookDelivery row per attempt on a successful delivery', async () => {
    const findFirstWebhook = jest.fn().mockResolvedValue({
      id: WEBHOOK_ID,
      targetUrl: 'https://example.com/hook',
      secret: 'shh',
    });
    const findFirstPost = jest.fn().mockResolvedValue({
      id: POST_ID,
      title: 'Add dark mode',
      body: 'Please',
      status: 'OPEN',
      voteCount: 0,
    });
    const createDelivery = jest.fn().mockResolvedValue(undefined);
    const { runner } = buildRunner({ findFirstWebhook, findFirstPost, createDelivery });
    const deliver = jest.fn().mockResolvedValue({ responseStatus: 200 });
    const delivery = { deliver } as unknown as WebhookDeliveryService;
    const { logger } = buildLogger();
    const processor = new WebhookDeliveryProcessor(runner, delivery, logger);

    await processor.process(
      buildJob({ orgId: ORG_ID, webhookId: WEBHOOK_ID, event: 'post.created', postId: POST_ID }, 1),
    );

    expect(deliver).toHaveBeenCalledWith(
      'https://example.com/hook',
      'shh',
      'post.created',
      expect.objectContaining({ id: POST_ID }),
    );
    // attempt is BullMQ's own 1-based attemptsMade counter (TDD §3.7) — job.attemptsMade was 1,
    // so this is the second attempt.
    expect(createDelivery).toHaveBeenCalledWith({
      data: {
        webhookId: WEBHOOK_ID,
        orgId: ORG_ID,
        event: 'post.created',
        payload: expect.objectContaining({ id: POST_ID }),
        responseStatus: 200,
        attempt: 2,
      },
    });
  });

  it('writes a failed-attempt row and throws to trigger a BullMQ retry on a non-2xx response', async () => {
    const findFirstWebhook = jest.fn().mockResolvedValue({
      id: WEBHOOK_ID,
      targetUrl: 'https://example.com/hook',
      secret: 'shh',
    });
    const findFirstPost = jest.fn().mockResolvedValue({ id: POST_ID });
    const createDelivery = jest.fn().mockResolvedValue(undefined);
    const { runner } = buildRunner({ findFirstWebhook, findFirstPost, createDelivery });
    const deliver = jest.fn().mockResolvedValue({ responseStatus: 500 });
    const delivery = { deliver } as unknown as WebhookDeliveryService;
    const { logger } = buildLogger();
    const processor = new WebhookDeliveryProcessor(runner, delivery, logger);

    await expect(
      processor.process(
        buildJob({ orgId: ORG_ID, webhookId: WEBHOOK_ID, event: 'post.created', postId: POST_ID }),
      ),
    ).rejects.toThrow(`deliver: webhook ${WEBHOOK_ID} responded 500`);

    expect(createDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ responseStatus: 500 }) }),
    );
  });

  it('writes a null-status row and throws on a network error', async () => {
    const findFirstWebhook = jest.fn().mockResolvedValue({
      id: WEBHOOK_ID,
      targetUrl: 'https://example.com/hook',
      secret: 'shh',
    });
    const findFirstPost = jest.fn().mockResolvedValue({ id: POST_ID });
    const createDelivery = jest.fn().mockResolvedValue(undefined);
    const { runner } = buildRunner({ findFirstWebhook, findFirstPost, createDelivery });
    const deliver = jest.fn().mockResolvedValue({ responseStatus: null });
    const delivery = { deliver } as unknown as WebhookDeliveryService;
    const { logger } = buildLogger();
    const processor = new WebhookDeliveryProcessor(runner, delivery, logger);

    await expect(
      processor.process(
        buildJob({ orgId: ORG_ID, webhookId: WEBHOOK_ID, event: 'post.created', postId: POST_ID }),
      ),
    ).rejects.toThrow(`deliver: webhook ${WEBHOOK_ID} responded null`);

    expect(createDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ responseStatus: null }) }),
    );
  });
});
