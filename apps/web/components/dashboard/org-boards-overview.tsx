'use client';

import type { Board } from '@feedback-board/shared';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { useNavigate } from '../../lib/use-navigate';
import { Button, Dialog } from '../ui';
import { BoardList } from './board-list';
import { CreateBoardForm } from './create-board-form';

interface OrgBoardsOverviewProps {
  orgSlug: string;
  /** The boards fetched server-side by the parent Server Component (TDD §12). */
  initialBoards: Board[];
}

/**
 * Client island combining the read-only board list with the creation form (TDD §13 step 19.2),
 * mirroring `OrgPicker`'s shape (Step 19.1). The form opens in a `Dialog` instead of sitting
 * inline (§13 step 19.7 follow-up). A freshly created board is opened, not appended to the list:
 * it is where the user works next.
 */
export function OrgBoardsOverview({
  orgSlug,
  initialBoards,
}: OrgBoardsOverviewProps): ReactElement {
  const t = useTranslations('dashboard.orgOverview.createBoard');
  const tCommon = useTranslations('common');
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleCreated(board: Board): void {
    // A new board is a place to work in, so open it; the dialog stays up (button pending) until
    // the board page has rendered.
    navigate.push(`/dashboard/${orgSlug}/boards/${board.slug}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('trigger')}
        </Button>
      </div>
      <BoardList orgSlug={orgSlug} boards={initialBoards} />
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t('title')}
        closeLabel={tCommon('close')}
      >
        <CreateBoardForm
          orgSlug={orgSlug}
          onCreated={handleCreated}
          navigating={navigate.isPending}
        />
      </Dialog>
    </div>
  );
}
