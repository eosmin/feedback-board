import { boardDetailSchema } from '@feedback-board/shared';
import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { BoardDetailView } from '../../../../../components/boards/board-detail-view';
import { serverApiFetch } from '../../../../../lib/api-client-server';

interface BoardDetailPageProps {
  params: Promise<{ orgSlug: string; boardSlug: string }>;
}

/**
 * The tab reads "<board name> · FeedbackBoard". A board that cannot be read here (unknown slug, no
 * access) leaves the org name from the layout as the title; the view itself shows the error.
 */
export async function generateMetadata({ params }: BoardDetailPageProps): Promise<Metadata> {
  const { orgSlug, boardSlug } = await params;
  const board = await serverApiFetch(
    `/orgs/${orgSlug}/boards/${boardSlug}`,
    boardDetailSchema,
  ).catch(() => null);
  return board === null ? {} : { title: board.name };
}

/**
 * `/dashboard/[orgSlug]/boards/[boardSlug]` (TDD §12, §13 step 19.3): the page itself is a Server
 * Component only to set the title; `BoardDetailView` is a Client Component end to end, per §12's
 * route table, since create/vote/comment/status-change are all interactive. Membership is enforced
 * by `OrgGuard` on the API side — a caller without access gets a `403` on the first `apiFetch` call
 * inside `BoardDetailView`, the same trust boundary every other authenticated route relies on.
 */
export default async function BoardDetailPage({
  params,
}: BoardDetailPageProps): Promise<ReactElement> {
  const { orgSlug, boardSlug } = await params;

  return <BoardDetailView orgSlug={orgSlug} boardSlug={boardSlug} />;
}
