import { publicBoardSchema, type PublicBoard } from '@feedback-board/shared';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { ApiError, publicApiFetch } from './api-client';

/**
 * A private board, an unknown board and an unknown org are all indistinguishable `404
 * { error: 'NOT_FOUND' }` responses from the API (TDD §11) — this is the one place that 404
 * becomes Next's `notFound()` boundary instead of a rendered error. Cached per request so the page
 * and `generateMetadata` share one fetch: the metadata call resolves the board before the first
 * byte, which is what lets an unknown board answer a real HTTP 404 to a crawler. The route has no
 * `loading.tsx` for the same reason: a boundary would start streaming before `notFound()` runs.
 */
export const getPublicBoard = cache(
  async (orgSlug: string, boardSlug: string): Promise<PublicBoard> => {
    try {
      return await publicApiFetch(`/public/${orgSlug}/${boardSlug}`, publicBoardSchema);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        notFound();
      }
      throw error;
    }
  },
);
