import { describe, expect, it } from 'vitest';

import { WEBHOOK_EVENTS, type WebhookEvent } from '../../../src/constants/webhook-events';

describe('WEBHOOK_EVENTS', () => {
  it('is the closed two-event set', () => {
    expect(WEBHOOK_EVENTS).toEqual(['post.created', 'post.status_changed']);
  });

  it('holds no duplicates', () => {
    expect(new Set(WEBHOOK_EVENTS).size).toBe(WEBHOOK_EVENTS.length);
  });

  it('infers its member type from the tuple', () => {
    const event: WebhookEvent = 'post.created';

    expect(WEBHOOK_EVENTS).toContain(event);
  });
});
