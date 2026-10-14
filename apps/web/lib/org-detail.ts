import { orgDetailSchema, type OrgDetail } from '@feedback-board/shared';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { serverApiFetch, ServerApiError } from './api-client-server';

/**
 * The API answers an org the caller cannot open and an org that does not exist with the same
 * `403`, so that slugs cannot be probed. To the person looking at the screen both are "not found",
 * which is also what the not-found copy says; a generic error with a retry button would be wrong
 * for something no retry fixes. Use it on every org-scoped server fetch that can run next to
 * `getOrgDetail`, so the same screen wins whichever request fails first.
 */
export function rethrowNoAccessAsNotFound(error: unknown): never {
  if (error instanceof ServerApiError && error.status === 403) {
    notFound();
  }
  throw error;
}

/**
 * Cached per request via React's `cache()`: the dashboard layout and the page it wraps both
 * need the same org's name/plan on every `/dashboard/[orgSlug]/**` render, and without this
 * they issued two identical `GET /orgs/:orgSlug` calls per navigation.
 */
export const getOrgDetail = cache((orgSlug: string): Promise<OrgDetail> =>
  serverApiFetch(`/orgs/${orgSlug}`, orgDetailSchema).catch(rethrowNoAccessAsNotFound),
);
