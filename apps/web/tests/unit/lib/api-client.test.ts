import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('../../../lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

import { apiFetch, ApiError, publicApiFetch } from '../../../lib/api-client';
import { createSupabaseBrowserClient } from '../../../lib/supabase/client';

const mockCreateSupabaseBrowserClient = vi.mocked(createSupabaseBrowserClient);

const originalFetch = global.fetch;
const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

function mockSession(accessToken: string | null): void {
  mockCreateSupabaseBrowserClient.mockReturnValue({
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

describe('apiFetch', () => {
  const responseSchema = z.object({ id: z.string() });

  it('attaches the Supabase access token as a bearer header when a session exists', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    mockSession('token-123');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'abc' }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await apiFetch('/orgs', responseSchema);

    expect(result).toEqual({ id: 'abc' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/orgs',
      expect.objectContaining({
        method: 'GET',
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

    await apiFetch('/orgs', responseSchema);

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

    await apiFetch('/orgs', responseSchema, { method: 'POST', body: { name: 'Acme' } });

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

    await apiFetch('/orgs/acme', z.null());

    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('throws an ApiError carrying the status and the error-code body on a non-2xx response', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    mockSession('token-123');
    const errorBody = { error: 'PLAN_LIMIT', limit: 'boards', plan: 'FREE', cap: 1 };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(errorBody), { status: 403 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    // A single call, inspected via .then's rejection branch — calling apiFetch twice would try
    // to read the same Response body twice, which throws its own (unrelated) TypeError.
    await apiFetch('/orgs/acme/boards', responseSchema, { method: 'POST' }).then(
      () => expect.unreachable('expected apiFetch to reject'),
      (error: unknown) => {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.status).toBe(403);
        expect(apiError.body).toEqual(errorBody);
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

    await expect(apiFetch('/orgs/acme', responseSchema)).rejects.toThrow();
  });
});

describe('publicApiFetch', () => {
  const responseSchema = z.object({ id: z.string() });

  it('sends no Authorization header and never touches Supabase', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'abc' }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await publicApiFetch('/public/acme/roadmap', responseSchema);

    expect(result).toEqual({ id: 'abc' });
    expect(mockCreateSupabaseBrowserClient).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.test/public/acme/roadmap');
    expect(init.cache).toBe('no-store');
    expect(init.headers).toBeUndefined();
  });

  it('throws an ApiError carrying the NOT_FOUND body on a 404 response', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    const errorBody = { error: 'NOT_FOUND' };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(errorBody), { status: 404 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await publicApiFetch('/public/acme/roadmap', responseSchema).then(
      () => expect.unreachable('expected publicApiFetch to reject'),
      (error: unknown) => {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(404);
        expect((error as ApiError).body).toEqual(errorBody);
      },
    );
  });
});
