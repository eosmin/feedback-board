'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition, type ReactElement } from 'react';

import { Button } from './button';

export interface RouteErrorProps {
  /** The `retry` Next passes to `error.tsx`: re-fetches and re-renders, unlike `reset`. */
  retry: () => void;
}

/**
 * The body of every `error.tsx`. Deliberately generic: the API answers with error codes, never
 * prose, and a Server Component error reaches the client with its message stripped.
 */
export function RouteError({ retry }: RouteErrorProps): ReactElement {
  const t = useTranslations('common.routeError');
  const [pending, startTransition] = useTransition();

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-start gap-3 p-6">
      <TriangleAlert className="h-6 w-6 text-danger" aria-hidden="true" />
      <h1 className="text-display text-text">{t('title')}</h1>
      <p className="text-body text-text-muted">{t('description')}</p>
      <Button pending={pending} onClick={() => startTransition(retry)}>
        {t('retry')}
      </Button>
    </div>
  );
}
