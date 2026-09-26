import { publicBoardSchema, publicPostSchema } from '@feedback-board/shared';
import type { PublicBoard } from '@feedback-board/shared';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { PublicPostList } from '../../../../components/boards/public-post-list';
import { ApiError, publicApiFetch } from '../../../../lib/api-client';

const publicPostListSchema = z.array(publicPostSchema);

interface PublicBoardPageProps {
  params: Promise<{ orgSlug: string; boardSlug: string }>;
}

/**
 * `/[orgSlug]/[boardSlug]` (TDD §12) — SSR read of the public board. `/login`, `/dashboard`,
 * `/auth` and `/api` are static segments and therefore win over this dynamic route (§12); the
 * org-creation DTO already rejects those as slugs (Step 3), so no org can ever collide here.
 */
export default async function PublicBoardPage({
  params,
}: PublicBoardPageProps): Promise<ReactElement> {
  const { orgSlug, boardSlug } = await params;

  const board = await fetchBoardOrNotFound(orgSlug, boardSlug);
  const posts = await publicApiFetch(`/public/${orgSlug}/${boardSlug}/posts`, publicPostListSchema);

  return (
    <main>
      <h1>{board.name}</h1>
      <PublicPostList posts={posts} />
    </main>
  );
}

/**
 * A private board, an unknown board and an unknown org are all indistinguishable `404
 * { error: 'NOT_FOUND' }` responses from the API (TDD §11) — this is the one place that 404
 * becomes Next's `notFound()` boundary instead of a rendered error.
 */
async function fetchBoardOrNotFound(orgSlug: string, boardSlug: string): Promise<PublicBoard> {
  try {
    return await publicApiFetch(`/public/${orgSlug}/${boardSlug}`, publicBoardSchema);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
