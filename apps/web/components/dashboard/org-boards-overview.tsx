'use client';

import type { Board } from '@feedback-board/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { BoardList } from './board-list';
import { CreateBoardForm } from './create-board-form';

interface OrgBoardsOverviewProps {
  orgSlug: string;
  /** The boards fetched server-side by the parent Server Component (TDD §12). */
  initialBoards: Board[];
}

/**
 * Client island combining the read-only board list with the creation form (TDD §13 step 19.2),
 * mirroring `OrgPicker`'s shape (Step 19.1): a freshly created board is appended locally so the
 * list reflects it immediately, in addition to `router.refresh()` re-fetching the Server
 * Component's data.
 */
export function OrgBoardsOverview({
  orgSlug,
  initialBoards,
}: OrgBoardsOverviewProps): ReactElement {
  const [boards, setBoards] = useState(initialBoards);

  function handleCreated(board: Board): void {
    setBoards((current) => [...current, board]);
  }

  return (
    <>
      <BoardList orgSlug={orgSlug} boards={boards} />
      <CreateBoardForm orgSlug={orgSlug} onCreated={handleCreated} />
    </>
  );
}
