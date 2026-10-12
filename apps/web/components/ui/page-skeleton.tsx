import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Card } from './card';
import { Skeleton } from './skeleton';

export interface PageSkeletonProps {
  /** Number of list rows under the header. */
  rows?: number;
  /** The wrapper box; match the page's own `<main>` classes so nothing shifts when data lands. */
  className?: string;
}

/**
 * The shared `loading.tsx` body: a `PageHeader`-sized bar followed by `Card`-sized rows, in the
 * default page box (`flex flex-col gap-6 p-6`). A page whose layout differs passes `className` and
 * composes `Skeleton` directly in its own `loading.tsx`.
 */
export function PageSkeleton({
  rows = 3,
  className = 'flex flex-col gap-6 p-6',
}: PageSkeletonProps): ReactElement {
  const t = useTranslations('common');

  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{t('loading')}</span>
      <Skeleton className="h-9 w-56" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, index) => (
          <Card key={index}>
            <Skeleton className="h-12 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
