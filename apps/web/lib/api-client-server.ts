import type { ErrorCode } from '@feedback-board/shared';
import type { z } from 'zod';

import { createSupabaseServerClient } from './supabase/server';

/**
 * The Server Component counterpart of `apiFetch` (TDD §12, §16): Server Components read the
 * Supabase session from the request's cookie jar via `createSupabaseServerClient`, not from
 * `createSupabaseBrowserClient`, which assumes a browser context this render never has. Kept in
 * its own module rather than folded into `lib/api-client.ts` so that file stays importable from
 * Client Components without ever pulling in `next/headers` (server-only).
 */
export interface ServerApiErrorBody {
  error: ErrorCode;
  [key: string]: unknown;
}

export class ServerApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ServerApiErrorBody,
  ) {
    super(body.error);
    this.name = 'ServerApiError';
  }
}

function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL as string;
  return `${base}${path}`;
}

interface ServerRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function serverApiFetch<S extends z.ZodType>(
  path: string,
  schema: S,
  options: ServerRequestOptions = {},
): Promise<z.infer<S>> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(session !== null && { Authorization: `Bearer ${session.access_token}` }),
    },
    cache: 'no-store',
    ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
  };

  const response = await fetch(apiUrl(path), init);

  const json: unknown = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new ServerApiError(response.status, json as ServerApiErrorBody);
  }

  return schema.parse(json);
}
