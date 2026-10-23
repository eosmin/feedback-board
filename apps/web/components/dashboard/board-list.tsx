import type { BoardSummary } from '@feedback-board/shared';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Badge, Card, EmptyState, Link } from '../ui';

interface BoardListProps {
  orgSlug: string;
  boards: BoardSummary[];
}

/**
 * Renders an org's boards (TDD §11, §12). Each entry links to the board detail page at
 * `/dashboard/[orgSlug]/boards/[boardSlug]` (Step 19.3) — this component itself never fetches
 * or mutates.
 */
export function BoardList({ orgSlug, boards }: BoardListProps): ReactElement {
  const t = useTranslations('dashboard.orgOverview');
  const format = useFormatter();

  if (boards.length === 0) {
    return <EmptyState>{t('boardsEmpty')}</EmptyState>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {boards.map((board) => (
        <Card as="li" key={board.id}>
          <Link
            href={`/dashboard/${orgSlug}/boards/${board.slug}`}
            className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium">{board.name}</span>
              <Badge tone="neutral">
                {board.isPublic ? t('visibility.public') : t('visibility.private')}
              </Badge>
            </span>
            <span className="flex flex-wrap gap-x-4 text-body text-text-muted">
              <span>{t('postCount', { count: board.postCount })}</span>
              <span>
                {board.lastPostAt === null
                  ? t('noActivity')
                  : // UTC, not the viewer's zone: the server and the browser render this same
                    // string, and two zones would disagree near midnight and fail hydration.
                    t('lastActivity', {
                      date: format.dateTime(new Date(board.lastPostAt), {
                        dateStyle: 'medium',
                        timeZone: 'UTC',
                      }),
                    })}
              </span>
            </span>
          </Link>
        </Card>
      ))}
    </ul>
  );
}
