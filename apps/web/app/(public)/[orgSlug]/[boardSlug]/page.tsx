import { publicPostSchema } from '@feedback-board/shared';
import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { PublicPostList } from '../../../../components/boards/public-post-list';
import { PageHeader, PreferencesBar } from '../../../../components/ui';
import { publicApiFetch } from '../../../../lib/api-client';
import { getPublicBoard } from '../../../../lib/public-board';

const publicPostListSchema = z.array(publicPostSchema);

interface PublicBoardPageProps {
  params: Promise<{ orgSlug: string; boardSlug: string }>;
}

export async function generateMetadata({ params }: PublicBoardPageProps): Promise<Metadata> {
  const { orgSlug, boardSlug } = await params;
  const board = await getPublicBoard(orgSlug, boardSlug);
  return { title: board.name };
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

  const board = await getPublicBoard(orgSlug, boardSlug);
  const posts = await publicApiFetch(`/public/${orgSlug}/${boardSlug}/posts`, publicPostListSchema);

  return (
    <>
      <PreferencesBar />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 pb-6 pt-16">
        <PageHeader title={board.name} />
        <PublicPostList posts={posts} />
      </main>
    </>
  );
}
