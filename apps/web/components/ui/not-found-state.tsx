import { FileQuestion } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { buttonClassName } from './button';
import { Link } from './link';

/** The body of every `not-found.tsx`; the way back is `/`, which hands off to the org picker or to sign-in. */
export function NotFoundState(): ReactElement {
  const t = useTranslations('common.notFoundPage');

  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-3 p-6">
      <FileQuestion className="h-6 w-6 text-text-muted" aria-hidden="true" />
      <h1 className="text-display text-text">{t('title')}</h1>
      <p className="text-body text-text-muted">{t('description')}</p>
      <Link href="/" className={buttonClassName('secondary')}>
        {t('back')}
      </Link>
    </div>
  );
}
