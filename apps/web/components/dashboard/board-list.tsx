import type { Board } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { Badge, Card, EmptyState } from '../ui';

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
    return <EmptyState>{t('boardsEmpty')}</EmptyState>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {boards.map((board) => (
        <Card as="li" key={board.id}>
          <Link
            href={`/dashboard/${orgSlug}/boards/${board.slug}`}
            className="flex items-center justify-between gap-2"
          >
            <span className="font-medium">{board.name}</span>
            <Badge>{board.isPublic ? t('visibility.public') : t('visibility.private')}</Badge>
          </Link>
        </Card>
      ))}
    </ul>
  );
}
