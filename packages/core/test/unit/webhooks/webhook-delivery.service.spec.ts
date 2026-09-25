import { WebhookDeliveryService } from '../../../src/webhooks/webhook-delivery.service';

const TARGET_URL = 'https://example.com/hooks/receive';
const SECRET = 'a'.repeat(64);

function buildFetch(status: number): {
  fetchImpl: jest.MockedFunction<typeof fetch>;
  calls: () => Parameters<typeof fetch>[];
} {
  const fetchImpl = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  // `{ status }` alone does not structurally satisfy `Response` (it is missing `ok`, `headers`,
  // ...), so this cast is load-bearing once `fetchImpl` is properly typed against `typeof
  // fetch` — unlike an untyped `jest.Mock`, where the cast was a no-op against an already-`any`
  // parameter and `@typescript-eslint/no-unnecessary-type-assertion` correctly flagged it.
  fetchImpl.mockResolvedValue({ status } as Response);
  return { fetchImpl, calls: () => fetchImpl.mock.calls };
}

describe('WebhookDeliveryService', () => {
  it('signs the JSON body with HMAC-SHA256(secret) and sends the signature + event headers', async () => {
    const { fetchImpl, calls } = buildFetch(200);
    const service = new WebhookDeliveryService();

    const result = await service.deliver(
      TARGET_URL,
      SECRET,
      'post.created',
      { id: 'post-1' },
      fetchImpl,
    );

    expect(result).toEqual({ responseStatus: 200 });
    const [url, init] = calls()[0] as [string, RequestInit];
    expect(url).toBe(TARGET_URL);
    const headers = init.headers as Record<string, string>;
    expect(headers['X-FeedbackBoard-Event']).toBe('post.created');
    expect(headers['X-FeedbackBoard-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);

    // The signature must actually verify against the sent body, computed independently here.
    const { createHmac } = await import('node:crypto');
    const expectedSignature = createHmac('sha256', SECRET)
      .update(init.body as string)
      .digest('hex');
    expect(headers['X-FeedbackBoard-Signature']).toBe(`sha256=${expectedSignature}`);

    const body = JSON.parse(init.body as string) as { event: string; data: unknown };
    expect(body.event).toBe('post.created');
    expect(body.data).toEqual({ id: 'post-1' });
  });

  it('returns a null responseStatus on a network error, never throwing', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const service = new WebhookDeliveryService();

    const result = await service.deliver(
      TARGET_URL,
      SECRET,
      'post.created',
      { id: 'post-1' },
      fetchImpl,
    );

    expect(result).toEqual({ responseStatus: null });
  });

  it('reports a non-2xx response status without throwing', async () => {
    const { fetchImpl } = buildFetch(500);
    const service = new WebhookDeliveryService();

    const result = await service.deliver(TARGET_URL, SECRET, 'post.created', {}, fetchImpl);

    expect(result).toEqual({ responseStatus: 500 });
  });

  it('falls back to globalThis.fetch when no fetchImpl argument is supplied', async () => {
    // Exercises the default-parameter branch itself (`fetchImpl = globalThis.fetch`), not just
    // that the constructor tolerates a missing argument — a previous version of this test never
    // called deliver() without fetchImpl, so Istanbul counted this branch as 0% covered despite
    // every statement in the method running under the other three tests.
    const originalFetch = globalThis.fetch;
    const mockFetch = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    mockFetch.mockResolvedValue({ status: 204 } as Response);
    globalThis.fetch = mockFetch;

    try {
      const service = new WebhookDeliveryService();
      const result = await service.deliver(TARGET_URL, SECRET, 'post.created', { id: 'post-1' });

      expect(result).toEqual({ responseStatus: 204 });
      expect(mockFetch).toHaveBeenCalledWith(TARGET_URL, expect.any(Object));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
