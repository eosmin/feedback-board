import { orgDetailSchema, type OrgDetail } from '@feedback-board/shared';
import { cache } from 'react';

import { serverApiFetch } from './api-client-server';

/**
 * Cached per request via React's `cache()`: the dashboard layout and the page it wraps both
 * need the same org's name/plan on every `/dashboard/[orgSlug]/**` render, and without this
 * they issued two identical `GET /orgs/:orgSlug` calls per navigation.
 */
export const getOrgDetail = cache((orgSlug: string): Promise<OrgDetail> =>
  serverApiFetch(`/orgs/${orgSlug}`, orgDetailSchema),
);
