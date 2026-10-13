import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Card, PageHeader, Skeleton } from '../ui';
import { CreateOrgButton } from './create-org-button';
import { ORG_GRID_CLASSNAME } from './org-list';
import { PickerHeader } from './picker-header';

const PLACEHOLDER_CARDS = 3;

/**
 * Mirrors the org picker: the real account bar, `PageHeader` and create button (none needs data;
 * the button is disabled and hidden from assistive tech), then the same grid of cards `OrgList`
 * renders. Used by the picker's own `loading.tsx` and by the dashboard-level fallback.
 */
export function PickerLoading(): ReactElement {
  const t = useTranslations('common');
  const tDashboard = useTranslations('dashboard');

  return (
    <>
      <PickerHeader />
      {/* A `<main>` like the real page: the global `main` rule centres and caps the width, which a
          plain `div` would not get, so the grid would jump when the data lands. */}
      <main aria-busy="true" className="flex flex-col gap-6 p-6">
        <span role="status" className="sr-only">
          {t('loading')}
        </span>
        <PageHeader
          title={tDashboard('title')}
          action={
            <div aria-hidden="true" className="flex">
              <CreateOrgButton disabled />
            </div>
          }
        />
        <div className={ORG_GRID_CLASSNAME}>
          {Array.from({ length: PLACEHOLDER_CARDS }, (_, index) => (
            <Card key={index} className="flex flex-col gap-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-5 w-24" />
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
