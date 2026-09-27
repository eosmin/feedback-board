import type { Board } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactElement } from 'react';

interface BoardListProps {
  orgSlug: string;
  boards: Board[];
}

/**
 * Renders an org's boards (TDD §11, §12). Each entry links to the board detail page at
 * `/dashboard/[orgSlug]/boards/[boardSlug]` (Step 19.3) — this component itself never fetches
 * or mutates.
 */
export function BoardList({ orgSlug, boards }: BoardListProps): ReactElement {
  const t = useTranslations('dashboard.orgOverview');

  if (boards.length === 0) {
    return <p>{t('boardsEmpty')}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {boards.map((board) => (
        <li key={board.id} className="rounded-lg border border-brand-100 p-4">
          <Link
            href={`/dashboard/${orgSlug}/boards/${board.slug}`}
            className="flex items-center justify-between gap-2"
          >
            <span className="font-medium">{board.name}</span>
            <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">
              {board.isPublic ? t('visibility.public') : t('visibility.private')}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
