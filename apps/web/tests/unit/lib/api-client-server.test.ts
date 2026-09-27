import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('../../../lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { serverApiFetch, ServerApiError } from '../../../lib/api-client-server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);

const originalFetch = global.fetch;
const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

function mockSession(accessToken: string | null): void {
  mockCreateSupabaseServerClient.mockResolvedValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: accessToken === null ? null : { access_token: accessToken } },
      }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

afterEach(() => {
  global.fetch = originalFetch;
  process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  vi.restoreAllMocks();
});

describe('serverApiFetch', () => {
  const responseSchema = z.object({ id: z.string() });

  it('attaches the Supabase access token as a bearer header and disables caching', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    mockSession('token-123');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'abc' }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await serverApiFetch('/orgs', responseSchema);

    expect(result).toEqual({ id: 'abc' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/orgs',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
      }),
    );
  });

  it('sends no Authorization header when there is no session', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    mockSession(null);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'abc' }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await serverApiFetch('/orgs', responseSchema);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(Object.keys(init.headers as Record<string, string>)).not.toContain('Authorization');
  });

  it('serializes a request body and omits it entirely for a bodyless request', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    mockSession('token-123');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'abc' }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await serverApiFetch('/orgs', responseSchema, { method: 'POST', body: { name: 'Acme' } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ name: 'Acme' }));
    expect('body' in init).toBe(true);
  });

  it('treats a 204 response as no body without calling response.json()', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    mockSession('token-123');
    const response = new Response(null, { status: 204 });
    const jsonSpy = vi.spyOn(response, 'json');
    const fetchMock = vi.fn().mockResolvedValue(response);
    global.fetch = fetchMock as unknown as typeof fetch;

    await serverApiFetch('/orgs/acme', z.null());

    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('throws a ServerApiError carrying the status and the error-code body on a non-2xx response', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    mockSession('token-123');
    const errorBody = { error: 'UNAUTHORIZED' };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(errorBody), { status: 401 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await serverApiFetch('/orgs', responseSchema).then(
      () => expect.unreachable('expected serverApiFetch to reject'),
      (error: unknown) => {
        expect(error).toBeInstanceOf(ServerApiError);
        const serverError = error as ServerApiError;
        expect(serverError.status).toBe(401);
        expect(serverError.body).toEqual(errorBody);
      },
    );
  });

  it('throws a Zod validation error when the response no longer matches its schema', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    mockSession('token-123');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ unexpected: true }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(serverApiFetch('/orgs', responseSchema)).rejects.toThrow();
  });
});
