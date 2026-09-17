import { describe, expect, it } from 'vitest';

import {
  createWebhookSchema,
  webhookCreatedSchema,
  webhookDeliverySchema,
  webhookPayloadSchema,
  webhookSchema,
} from '../../../src/schemas/webhook';

const UUID = '3f1a7c2e-9b4d-4f8a-9c1e-7d5b2a6e0f43';
const CREATED_AT = '2026-09-07T10:15:00.000Z';

describe('createWebhookSchema', () => {
  it('accepts a target subscribed to both events', () => {
    const result = createWebhookSchema.safeParse({
      targetUrl: 'https://example.com/hooks/feedback',
      events: ['post.created', 'post.status_changed'],
    });

    expect(result.success).toBe(true);
  });

  it('rejects a target that is not a url', () => {
    const result = createWebhookSchema.safeParse({
      targetUrl: 'example.com/hooks',
      events: ['post.created'],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty subscription list', () => {
    const result = createWebhookSchema.safeParse({
      targetUrl: 'https://example.com/hooks',
      events: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an event outside the closed set', () => {
    const result = createWebhookSchema.safeParse({
      targetUrl: 'https://example.com/hooks',
      events: ['post.deleted'],
    });

    expect(result.success).toBe(false);
  });
});

describe('webhookSchema', () => {
  const webhook = {
    id: UUID,
    orgId: UUID,
    targetUrl: 'https://example.com/hooks',
    events: ['post.created'],
    isActive: true,
    createdAt: CREATED_AT,
  };

  it('accepts a stored webhook', () => {
    expect(webhookSchema.safeParse(webhook).success).toBe(true);
  });

  it('accepts a deactivated webhook, since a downgrade keeps the row', () => {
    expect(webhookSchema.safeParse({ ...webhook, isActive: false }).success).toBe(true);
  });

  it('strips the secret from the list shape', () => {
    const result = webhookSchema.safeParse({ ...webhook, secret: 'deadbeef' });

    expect(result.success).toBe(true);
    expect(result.success && 'secret' in result.data).toBe(false);
  });

  it('carries the secret only on the creation shape', () => {
    expect(webhookCreatedSchema.safeParse(webhook).success).toBe(false);
    expect(webhookCreatedSchema.safeParse({ ...webhook, secret: 'deadbeef' }).success).toBe(true);
  });
});

describe('webhookDeliverySchema', () => {
  const delivery = {
    id: UUID,
    webhookId: UUID,
    orgId: UUID,
    event: 'post.created',
    payload: { id: UUID },
    responseStatus: 200,
    attempt: 1,
    createdAt: CREATED_AT,
  };

  it('accepts a successful attempt', () => {
    expect(webhookDeliverySchema.safeParse(delivery).success).toBe(true);
  });

  it('accepts a network error, which has no status', () => {
    expect(webhookDeliverySchema.safeParse({ ...delivery, responseStatus: null }).success).toBe(
      true,
    );
  });

  it('numbers attempts from one', () => {
    expect(webhookDeliverySchema.safeParse({ ...delivery, attempt: 0 }).success).toBe(false);
    expect(webhookDeliverySchema.safeParse({ ...delivery, attempt: 3 }).success).toBe(true);
  });
});

describe('webhookPayloadSchema', () => {
  it('accepts the signed envelope', () => {
    const result = webhookPayloadSchema.safeParse({
      event: 'post.status_changed',
      data: { id: UUID, status: 'DONE' },
      timestamp: CREATED_AT,
    });

    expect(result.success).toBe(true);
  });

  it('rejects an envelope without a timestamp', () => {
    const result = webhookPayloadSchema.safeParse({ event: 'post.created', data: {} });

    expect(result.success).toBe(false);
  });
});
