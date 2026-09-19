import { classifyPostJobSchema, deliverWebhookJobSchema } from '../../../src/schemas/jobs';

// Valid RFC 4122 v4 UUIDs — the 13th hex digit must be '4' and the 17th one of '8','9','a','b',
// which zod's z.uuid() enforces; an all-same-digit string like '11111111-...' fails that check.
const orgId = '11111111-1111-4111-8111-111111111111';
const postId = '22222222-2222-4222-8222-222222222222';
const webhookId = '33333333-3333-4333-8333-333333333333';

describe('deliverWebhookJobSchema', () => {
  it('accepts a valid payload', () => {
    const result = deliverWebhookJobSchema.safeParse({
      orgId,
      webhookId,
      event: 'post.created',
      postId,
    });

    expect(result.success).toBe(true);
  });

  it('rejects a payload with an unknown event name', () => {
    const result = deliverWebhookJobSchema.safeParse({
      orgId,
      webhookId,
      event: 'post.deleted',
      postId,
    });

    expect(result.success).toBe(false);
  });

  it('rejects a payload carrying tenant content instead of ids', () => {
    const result = deliverWebhookJobSchema.safeParse({
      orgId,
      webhookId,
      event: 'post.created',
      postId,
      title: 'leaked title',
    });

    // Zod's default object mode strips unknown keys rather than rejecting them; assert the
    // extra field never survives parsing, since a leaked title must never reach the worker.
    expect(result.success && 'title' in result.data).toBe(false);
  });
});

describe('classifyPostJobSchema', () => {
  it('accepts a valid payload', () => {
    const result = classifyPostJobSchema.safeParse({ orgId, postId });

    expect(result.success).toBe(true);
  });

  it('rejects a malformed orgId', () => {
    const result = classifyPostJobSchema.safeParse({ orgId: 'not-a-uuid', postId });

    expect(result.success).toBe(false);
  });

  it('rejects a payload missing postId', () => {
    const result = classifyPostJobSchema.safeParse({ orgId });

    expect(result.success).toBe(false);
  });
});
