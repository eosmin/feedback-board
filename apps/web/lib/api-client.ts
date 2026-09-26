import type { ErrorCode } from '@feedback-board/shared';
import type { z } from 'zod';

import { createSupabaseBrowserClient } from './supabase/client';

/**
 * The shape of every non-2xx response body the API returns (TDD §2.6.13, §7.8): a machine
 * code, never a sentence. `PLAN_LIMIT` additionally carries `limit`/`plan`/`cap`, and
 * `VALIDATION_FAILED` carries `fields` — both are read through `ApiError`'s `body` rather than
 * being modeled as separate types, since callers narrow on `error` before touching the rest.
 */
export interface ApiErrorBody {
  error: ErrorCode;
  [key: string]: unknown;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
  ) {
    super(body.error);
    this.name = 'ApiError';
  }
}

/**
 * `NEXT_PUBLIC_API_URL` is the only source of the API's location (TDD §16) — never a hardcoded
 * host, and never `STRIPE_SECRET_KEY`/`AI_GATEWAY_API_KEY`/a database URL, none of which this
 * package imports or references anywhere (TDD §17).
 */
function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL as string;
  return `${base}${path}`;
}

async function authHeader(): Promise<Record<string, string>> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session === null ? {} : { Authorization: `Bearer ${session.access_token}` };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

/**
 * Typed `fetch` wrapper: every response is parsed as JSON and validated against a shared Zod
 * schema before the caller ever sees it (TDD §7.1, §7.5) — a response the API returns that no
 * longer matches its own contract fails loudly here instead of producing a silent `undefined`
 * deep inside a component.
 */
export async function apiFetch<S extends z.ZodType>(
  path: string,
  schema: S,
  options: RequestOptions = {},
): Promise<z.infer<S>> {
  const auth = await authHeader();

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...auth,
    },
    ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
  };

  const response = await fetch(apiUrl(path), init);

  const json: unknown = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, json as ApiErrorBody);
  }

  return schema.parse(json);
}
