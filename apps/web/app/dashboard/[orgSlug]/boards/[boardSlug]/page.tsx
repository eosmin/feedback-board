'use client';

import { use } from 'react';
import type { ReactElement } from 'react';

import { BoardDetailView } from '../../../../../components/boards/board-detail-view';

interface BoardDetailPageProps {
  params: Promise<{ orgSlug: string; boardSlug: string }>;
}

/**
 * `/dashboard/[orgSlug]/boards/[boardSlug]` (TDD §12, §13 step 19.3) — a Client Component end to
 * end, per §12's route table, since create/vote/comment/status-change are all interactive.
 * `params` is a Promise even in a Client Component under Next 16; `use()` unwraps it without an
 * `async` component, which Client Components cannot be. Membership is enforced by `OrgGuard` on
 * the API side — a caller without access gets a `403` on the first `apiFetch` call inside
 * `BoardDetailView`, the same trust boundary every other authenticated route relies on.
 */
export default function BoardDetailPage({ params }: BoardDetailPageProps): ReactElement {
  const { orgSlug, boardSlug } = use(params);

  return <BoardDetailView orgSlug={orgSlug} boardSlug={boardSlug} />;
}
