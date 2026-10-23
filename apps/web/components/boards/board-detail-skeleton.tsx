import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Card, Skeleton } from '../ui';

const POST_PLACEHOLDERS = 4;

/**
 * The board page before its data lands, drawn at the real page's proportions: title and the two
 * header actions (share and new feedback, which every role gets), the AI summary bar, the search
 * and filter row and a few dense rows. The bar is OWNER/ADMIN only and the role is not known yet,
 * so a MEMBER sees it vanish once the page loads; the product's main audience is the admin, which
 * is the case worth stable. Shared by the route's `loading.tsx` and by `BoardDetailView` while it
 * fetches, so the two hand-offs are the same picture. The `<main>` box (padding, gap) comes from
 * the global `main` rule, same as the real page.
 */
export function BoardDetailSkeleton(): ReactElement {
  const t = useTranslations('common');

  return (
    <main aria-busy="true">
      <span role="status" className="sr-only">
        {t('loading')}
      </span>
      {/* Same box as `PageHeader`: keep the two in step. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-44" />
        </div>
      </div>
      {/* The AI bar: one row as tall as its button. */}
      <Card as="section">
        <Skeleton className="h-10 w-full" />
      </Card>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      <ul className="flex flex-col gap-2">
        {Array.from({ length: POST_PLACEHOLDERS }, (_, index) => (
          <li
            key={index}
            className="flex h-[8.375rem] gap-3 rounded-control border border-border bg-surface-raised p-4 shadow-surface"
          >
            <Skeleton className="h-14 w-12 shrink-0" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-5 w-40" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
